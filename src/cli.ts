import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, readFile, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { version } from '../package.json';
import { Account, Quota, parseAccount, parseQuota, record } from './quota';
import { errorMessage, fail, LocalizedError, Message, message, t } from './i18n';

export interface QueryOptions {
  cliPath: string;
  codexHome: string;
  timeoutMs: number;
  accountOnly?: boolean;
}

export interface QueryDiagnostic {
  phase: string;
  phaseKey?: QueryPhase;
  cliPath?: string;
  codexHome: string;
  exitCode?: number | null;
  signal?: string | null;
}

type QueryPhase = 'phaseFind' | 'phaseInitialize' | 'phaseAccount' | 'phaseQuota' | 'phaseConfirm';

export class CodexQueryError extends LocalizedError {
  constructor(translation: Message, readonly diagnostic: QueryDiagnostic) {
    super(translation);
    this.name = 'CodexQueryError';
  }
}

interface CliCommand {
  executable: string;
  args: string[];
  packageRoot?: string;
}

class CliResolutionError extends LocalizedError {
  constructor(translation: Message, readonly launcher: string) { super(translation); }
}

function failureHint(stderr: string, code: number | null): Message {
  const status = code === null ? undefined : code >>> 0;
  if (status === 0xc0000135) return message('dllMissing');
  if (status === 0xc000007b) return message('wrongArchitecture');
  if (status === 0xc0000142) return message('runtimeFailure');
  // Only expose fixed classifications; CLI stderr may contain credentials or config values.
  if (/CODEX_HOME.*not a directory|failed to (?:find|resolve).*codex.home/i.test(stderr)) return message('invalidHomeHint');
  if (/unexpected argument|unrecognized (?:argument|option)|invalid value.*--listen/i.test(stderr)) return message('argumentsHint');
  if (/sqlite|database is locked|unable to open database/i.test(stderr)) return message('databaseHint');
  if (/permission denied|access is denied|read.only|os error (?:5|13|30)\b/i.test(stderr)) return message('permissionHint');
  if (/error (?:loading|parsing).*config|invalid configuration|toml parse error|error parsing -c/i.test(stderr)) return message('configHint');
  if (/\b(?:auth(?:entication|orization)?|credentials?|keyring|token|unauthorized|401)\b/i.test(stderr)) return message('authHint');
  if (/proxy|dns|connection refused|certificate|tls|network/i.test(stderr)) return message('networkHint');
  return message('exitHint');
}

class ProcessExitError extends LocalizedError {
  constructor(phase: QueryPhase, readonly exitCode: number | null, readonly signal: string | null, stderr: string) {
    const status = exitCode === null ? message('unknown') : `${exitCode}${exitCode < 0 || exitCode > 255 ? ` / 0x${(exitCode >>> 0).toString(16).toUpperCase()}` : ''}`;
    super(message('processExit', { phase: message(phase), status, signal: signal ? message('signal', { value: signal }) : '', hint: failureHint(stderr, exitCode) }));
  }
}

export interface Snapshot {
  hostIp?: string;
  publicIp?: string;
  account: Account;
  quota?: Quota;
  cliPath: string;
  codexHome: string;
  checkedAt: Date;
}

export function expandHome(value: string): string {
  if (value === '~') return homedir();
  return value.startsWith('~/') || value.startsWith('~\\') ? path.join(homedir(), value.slice(2)) : value;
}

async function windowsCodexExecutable(entry: string, arch: string): Promise<string | undefined> {
  if (path.basename(entry).toLowerCase() !== 'codex.js' || path.basename(path.dirname(entry)) !== 'bin') return undefined;
  const packageRoot = path.dirname(path.dirname(entry));
  let manifest: unknown;
  try { manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')); } catch { return undefined; }
  if (!record(manifest) || manifest.name !== '@openai/codex') return undefined;

  const target = arch === 'x64' ? 'x86_64-pc-windows-msvc' : arch === 'arm64' ? 'aarch64-pc-windows-msvc' : undefined;
  if (!target) throw fail('unsupportedArchitecture');
  const vendorRoots: string[] = [];
  try {
    const platformManifest = createRequire(entry).resolve(`@openai/codex-win32-${arch}/package.json`);
    vendorRoots.push(path.join(path.dirname(platformManifest), 'vendor'));
  } catch { /* Older official packages keep vendor inside @openai/codex. */ }
  vendorRoots.push(path.join(packageRoot, 'vendor'));
  for (const vendorRoot of vendorRoots) {
    for (const directory of ['bin', 'codex']) {
      const executable = path.join(vendorRoot, target, directory, 'codex.exe');
      try {
        await access(executable);
        return await realpath(executable);
      } catch { /* Try the next official package layout. */ }
    }
  }
  // Running the JS wrapper would spawn another console process without windowsHide.
  throw fail('nativeMissing');
}

function shimTarget(value: string, launcher: string, env: NodeJS.ProcessEnv): string | undefined {
  const directory = path.dirname(launcher) + path.sep;
  let target = value.replace(/%(?:~dp0|dp0%)/gi, () => directory)
    .replace(/\$(?:\{basedir\}|basedir|PSScriptRoot)(?=[\\/]|$)/gi, () => path.dirname(launcher));
  // Only expand standard installation directories. Never evaluate shell code,
  // variable assignments or an arbitrary environment variable in a launcher.
  target = target.replace(/%(APPDATA|LOCALAPPDATA|USERPROFILE|PROGRAMFILES(?:\(X86\))?|SYSTEMDRIVE)%/gi, (reference, name: string) => {
    const key = Object.keys(env).find(key => key.toLowerCase() === name.toLowerCase());
    return key && env[key] ? env[key]! : reference;
  });
  if (/[%$`\r\n]/.test(target)) return undefined;
  target = path.normalize(target.replace(/[\\/]/g, path.sep));
  return path.isAbsolute(target) ? target : undefined;
}

async function windowsShimCommand(launcher: string, env: NodeJS.ProcessEnv, arch: string): Promise<CliCommand> {
  const targets: string[] = [];
  try {
    if ((await stat(launcher)).size <= 32768) {
      const data = await readFile(launcher);
      const content = data.subarray(0, 2).equals(Buffer.from([255, 254])) ? data.subarray(2).toString('utf16le') : data.toString('utf8');
      // npm, pnpm and Yarn shims quote the official package entry. Resolve that
      // entry to the native executable instead of invoking its Node wrapper.
      for (const match of content.matchAll(/["']([^"'\r\n]*[\\/]@openai[\\/]codex[\\/]bin[\\/]codex\.js)["']/gi)) {
        const target = shimTarget(match[1], launcher, env);
        if (target) targets.push(target);
      }
      // A direct native launcher must forward arguments without injecting any.
      for (const match of content.matchAll(/^\s*@?(?:call\s+)?(?:&\s*)?["']([^"'\r\n]+)["']\s+(?:%\*|[$@]args)\s*$/gmi)) {
        const target = shimTarget(match[1], launcher, env);
        if (target && path.basename(target).toLowerCase() === 'codex.exe') targets.push(target);
      }
    }
  } catch { /* The adjacent standard npm layout may still be available. */ }
  targets.push(path.join(path.dirname(launcher), 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  let failure: LocalizedError | undefined;
  for (const target of new Set(targets)) {
    let resolved: string;
    try {
      if (!(await stat(target)).isFile()) continue;
      resolved = await realpath(target);
    } catch { continue; }
    if (path.basename(resolved).toLowerCase() === 'codex.exe') return { executable: resolved, args: [] };
    try {
      const native = await windowsCodexExecutable(resolved, arch);
      if (native) return { executable: native, args: [], packageRoot: path.dirname(path.dirname(resolved)) };
    } catch (error) {
      if (error instanceof LocalizedError) failure ??= error;
      else throw error;
    }
  }
  throw failure ?? fail('noShell');
}

export async function resolveCli(command: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform, arch = process.arch): Promise<CliCommand> {
  const expanded = expandHome(command.trim());
  if (!expanded) throw fail('cliRequired');
  const windows = platform === 'win32';
  const candidates = path.isAbsolute(expanded)
    ? [expanded]
    : expanded.includes('/') || expanded.includes('\\')
      ? [] // Relative workspace paths must not execute code from the current project.
      : (env.PATH ?? env.Path ?? '').split(windows ? ';' : path.delimiter).filter(dir => path.isAbsolute(dir))
        .flatMap(dir => windows && !path.extname(expanded)
          ? ['.exe', '.cmd', '.bat', '.ps1'].map(ext => path.join(dir, expanded + ext))
          : [path.join(dir, expanded)]);
  if (!candidates.length) throw fail(expanded.includes('/') || expanded.includes('\\') ? 'absoluteCli' : 'cliMissing');
  let failure: CliResolutionError | undefined;
  for (const candidate of candidates) {
    let found: string;
    try {
      await access(candidate, windows || /\.[cm]?js$/i.test(candidate) ? constants.F_OK : constants.X_OK);
      if (!(await stat(candidate)).isFile()) continue;
      found = await realpath(candidate);
    } catch { continue; }
    try {
      if (windows && /\.(cmd|bat|ps1)$/i.test(found)) return await windowsShimCommand(found, env, arch);
      if (windows) {
        const native = await windowsCodexExecutable(found, arch);
        if (native) return { executable: native, args: [], packageRoot: path.dirname(path.dirname(found)) };
      }
      return /\.[cm]?js$/i.test(found)
        ? { executable: process.execPath, args: [found] }
        : { executable: found, args: [] };
    } catch (error) {
      if (error instanceof LocalizedError) failure ??= new CliResolutionError(error.translation, found);
      else throw error;
      // A stale or unsupported launcher must not hide another usable PATH entry.
    }
  }
  throw failure ?? fail('cliMissing');
}

class RpcClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; method: string }>();
  private buffer = '';
  private stderr = '';
  private nextId = 1;
  private failure?: Error;
  private closed = false;
  private readonly abortListener: () => void;

  constructor(executable: string, args: string[], env: NodeJS.ProcessEnv, private readonly signal: AbortSignal, phase: () => QueryPhase) {
    this.child = spawn(executable, [...args, 'app-server', '--listen', 'stdio://'], {
      cwd: homedir(), env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.receive(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => { this.stderr = (this.stderr + chunk).slice(-16_384); });
    this.child.on('error', (error: NodeJS.ErrnoException) => this.fail(fail('spawnFailure', {
      code: error.code && /^[A-Z0-9_]+$/.test(error.code) ? error.code : message('unknownSystemError')
    })));
    // A startup failure can close stdin before `close` delivers its exit code/stderr.
    // Keep the request pending until close or the bounded query timeout.
    this.child.stdin.on('error', () => {});
    this.child.on('close', (code, signal) => {
      this.closed = true;
      this.fail(new ProcessExitError(phase(), code, signal, this.stderr));
      this.stderr = '';
    });
    this.abortListener = () => this.fail(signal.reason instanceof Error ? signal.reason : fail('cancelled'));
    signal.addEventListener('abort', this.abortListener, { once: true });
    if (signal.aborted) this.abortListener();
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.child.stdin.write(`${JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) })}\n`);
    });
  }

  initialized(): void {
    this.child.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`);
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > 1_048_576) {
      this.fail(fail('protocolSize'));
      return;
    }
    let end: number;
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end + 1);
      if (!line) continue;
      let message: unknown;
      try { message = JSON.parse(line); } catch {
        this.fail(fail('nonJson'));
        return;
      }
      if (!record(message) || typeof message.id !== 'number') continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      if (record(message.error)) {
        const code = typeof message.error.code === 'number' ? message.error.code : 'unknown';
        pending.reject(code === -32601 ? fail('unsupportedApi') : fail('rpcFailure', { method: pending.method, code }));
      } else if ('result' in message) pending.resolve(message.result);
      else pending.reject(fail('missingResult'));
    }
  }

  private fail(error: Error): void {
    this.failure ??= error;
    for (const pending of this.pending.values()) pending.reject(this.failure);
    this.pending.clear();
  }

  async dispose(): Promise<void> {
    this.signal.removeEventListener('abort', this.abortListener);
    this.fail(fail('finished'));
    if (this.closed) return;
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => { this.child.kill('SIGKILL'); resolve(); }, 500);
      this.child.once('close', () => { clearTimeout(timer); resolve(); });
      this.child.stdin.end();
      this.child.kill();
    });
  }
}

export async function queryCodex(options: QueryOptions, signal?: AbortSignal): Promise<Snapshot> {
  const controller = new AbortController();
  let stage: QueryPhase = 'phaseFind';
  const abort = () => controller.abort(fail('cancelled'));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(fail('timeout', { phase: message(stage), seconds: options.timeoutMs / 1000 })), options.timeoutMs);
  let client: RpcClient | undefined;
  let command: CliCommand | undefined;
  let codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex');
  try {
    command = await resolveCli(options.cliPath);
    if (controller.signal.aborted) throw controller.signal.reason;
    const configuredHome = expandHome(options.codexHome.trim());
    if (configuredHome && !path.isAbsolute(configuredHome)) throw fail('absoluteHome');
    codexHome = configuredHome || codexHome;
    const env: NodeJS.ProcessEnv = { ...process.env, ...(configuredHome ? { CODEX_HOME: configuredHome } : {}) };
    delete env.ELECTRON_RUN_AS_NODE;
    if (command.args.length) env.ELECTRON_RUN_AS_NODE = '1';
    if (command.packageRoot) env.CODEX_MANAGED_PACKAGE_ROOT = command.packageRoot;
    if (controller.signal.aborted) throw controller.signal.reason;
    stage = 'phaseInitialize';
    client = new RpcClient(command.executable, command.args, env, controller.signal, () => stage);
    const initialized = await client.request('initialize', {
      clientInfo: { name: 'codex_quota_vscode', title: 'Codex Quota', version },
      capabilities: { experimentalApi: false }
    });
    client.initialized();
    stage = 'phaseAccount';
    const account = parseAccount(await client.request('account/read', { refreshToken: false }));
    stage = 'phaseQuota';
    const quota = !options.accountOnly && account.type === 'chatgpt' ? parseQuota(await client.request('account/rateLimits/read')) : undefined;
    // Reject mixed-account snapshots if the account changes during the quota request.
    if (quota) {
      stage = 'phaseConfirm';
      const after = parseAccount(await client.request('account/read', { refreshToken: false }));
      if (JSON.stringify(after) !== JSON.stringify(account)) throw fail('accountChanged');
    }
    return {
      account, quota, checkedAt: new Date(),
      cliPath: command.args[0] ?? command.executable,
      codexHome: record(initialized) && typeof initialized.codexHome === 'string'
        ? initialized.codexHome : configuredHome || process.env.CODEX_HOME || path.join(homedir(), '.codex')
    };
  } catch (error) {
    throw new CodexQueryError(errorMessage(error), {
      phase: t('zh-CN', stage), phaseKey: stage, cliPath: command ? command.args[0] ?? command.executable
        : error instanceof CliResolutionError ? error.launcher : undefined, codexHome,
      ...(error instanceof ProcessExitError ? { exitCode: error.exitCode, signal: error.signal } : {})
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    await client?.dispose();
  }
}
