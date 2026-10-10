import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { version } from '../package.json';
import { Account, Quota, parseAccount, parseQuota, record } from './quota';

export interface QueryOptions {
  cliPath: string;
  codexHome: string;
  timeoutMs: number;
}

export interface QueryDiagnostic {
  phase: string;
  cliPath?: string;
  codexHome: string;
  exitCode?: number | null;
  signal?: string | null;
}

export class CodexQueryError extends Error {
  constructor(message: string, readonly diagnostic: QueryDiagnostic) {
    super(message);
    this.name = 'CodexQueryError';
  }
}

interface CliCommand {
  executable: string;
  args: string[];
  packageRoot?: string;
}

function failureHint(stderr: string, code: number | null): string {
  const status = code === null ? undefined : code >>> 0;
  if (status === 0xc0000135) return 'Windows 缺少 CLI 所需的 DLL；请修复 Codex 安装及运行库。';
  if (status === 0xc000007b) return 'Windows 无法加载此架构的可执行文件；请确认 CLI 与系统架构一致。';
  if (status === 0xc0000142) return 'Windows 无法初始化 CLI；请检查运行库或系统拦截记录。';
  // Only expose fixed classifications; CLI stderr may contain credentials or config values.
  if (/CODEX_HOME.*not a directory|failed to (?:find|resolve).*codex.home/i.test(stderr)) return 'CLI 报告 Codex 配置目录无效；请检查 codexQuota.codexHome 或 CODEX_HOME。';
  if (/unexpected argument|unrecognized (?:argument|option)|invalid value.*--listen/i.test(stderr)) return 'CLI 不支持启动参数；请检查 Codex 安装版本。';
  if (/sqlite|database is locked|unable to open database/i.test(stderr)) return 'CLI 报告状态数据库错误；请检查 Codex 数据目录权限或数据库占用。';
  if (/permission denied|access is denied|read.only|os error (?:5|13|30)\b/i.test(stderr)) return 'CLI 报告文件权限错误；请检查 Codex 配置及数据目录是否可写。';
  if (/error (?:loading|parsing).*config|invalid configuration|toml parse error|error parsing -c/i.test(stderr)) return 'CLI 报告配置解析或加载错误；请检查所选环境的 Codex 配置。';
  if (/\b(?:auth(?:entication|orization)?|credentials?|keyring|token|unauthorized|401)\b/i.test(stderr)) return 'CLI 报告认证或凭据存储错误；请在同一环境检查 codex login status。';
  if (/proxy|dns|connection refused|certificate|tls|network/i.test(stderr)) return 'CLI 报告网络或代理错误；请检查同一环境中的网络配置。';
  return '请查看诊断日志中的 CLI 路径与失败阶段，并在同一环境检查 codex app-server。';
}

class ProcessExitError extends Error {
  constructor(phase: string, readonly exitCode: number | null, readonly signal: string | null, stderr: string) {
    const status = exitCode === null ? '未知' : `${exitCode}${exitCode < 0 || exitCode > 255 ? ` / 0x${(exitCode >>> 0).toString(16).toUpperCase()}` : ''}`;
    super(`Codex app-server 在${phase}阶段提前退出（退出码 ${status}${signal ? `，信号 ${signal}` : ''}）。${failureHint(stderr, exitCode)}`);
  }
}

export interface Snapshot {
  hostIp?: string;
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
  if (!target) throw new Error('当前 Windows 架构不受 Codex CLI 支持。请设置原生 codex.exe 路径。');
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
  throw new Error('官方 Codex npm 包缺少 Windows 原生程序。请重新安装 @openai/codex，或将 cliPath 设为 codex.exe 的绝对路径。');
}

export async function resolveCli(command: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform, arch = process.arch): Promise<CliCommand> {
  const expanded = expandHome(command.trim());
  if (!expanded) throw new Error('请设置 Codex CLI 路径。');
  const windows = platform === 'win32';
  const candidates = path.isAbsolute(expanded)
    ? [expanded]
    : expanded.includes('/') || expanded.includes('\\')
      ? [] // Relative workspace paths must not execute code from the current project.
      : (env.PATH ?? env.Path ?? '').split(windows ? ';' : path.delimiter).filter(Boolean)
        .flatMap(dir => windows && !path.extname(expanded)
          ? ['.exe', '.cmd', '.bat'].map(ext => path.join(dir, expanded + ext))
          : [path.join(dir, expanded)]);
  if (!candidates.length) throw new Error('CLI 路径必须为绝对路径或 PATH 中的命令名。');
  let found: string | undefined;
  for (const candidate of candidates) {
    try {
      await access(candidate, windows || /\.[cm]?js$/i.test(candidate) ? constants.F_OK : constants.X_OK);
      found = await realpath(candidate);
      break;
    } catch { /* Try the next PATH entry. */ }
  }
  if (!found) throw new Error('找不到 Codex CLI。请在所选环境安装 Codex，并设置 codexQuota.cliPath。');
  if (windows && /\.(cmd|bat)$/i.test(found)) {
    const entry = path.join(path.dirname(found), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    try { await access(entry); } catch {
      throw new Error('不执行 shell 包装脚本。请将 cliPath 设为 codex.exe 或官方 npm 包的 bin/codex.js。');
    }
    found = await realpath(entry);
  }
  if (windows) {
    const native = await windowsCodexExecutable(found, arch);
    if (native) return { executable: native, args: [], packageRoot: path.dirname(path.dirname(found)) };
  }
  return /\.[cm]?js$/i.test(found)
    ? { executable: process.execPath, args: [found] }
    : { executable: found, args: [] };
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

  constructor(executable: string, args: string[], env: NodeJS.ProcessEnv, private readonly signal: AbortSignal, phase: () => string) {
    this.child = spawn(executable, [...args, 'app-server', '--listen', 'stdio://'], {
      cwd: homedir(), env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.receive(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => { this.stderr = (this.stderr + chunk).slice(-16_384); });
    this.child.on('error', (error: NodeJS.ErrnoException) => this.fail(new Error(
      `无法启动 Codex CLI（${error.code && /^[A-Z0-9_]+$/.test(error.code) ? error.code : '未知系统错误'}）；请检查可执行文件和权限。`
    )));
    // A startup failure can close stdin before `close` delivers its exit code/stderr.
    // Keep the request pending until close or the bounded query timeout.
    this.child.stdin.on('error', () => {});
    this.child.on('close', (code, signal) => {
      this.closed = true;
      this.fail(new ProcessExitError(phase(), code, signal, this.stderr));
      this.stderr = '';
    });
    this.abortListener = () => this.fail(signal.reason instanceof Error ? signal.reason : new Error('额度查询已取消。'));
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
      this.fail(new Error('Codex 协议输出超过安全大小限制。'));
      return;
    }
    let end: number;
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end + 1);
      if (!line) continue;
      let message: unknown;
      try { message = JSON.parse(line); } catch {
        this.fail(new Error('Codex app-server 返回了非 JSON 协议数据。'));
        return;
      }
      if (!record(message) || typeof message.id !== 'number') continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      if (record(message.error)) {
        const code = typeof message.error.code === 'number' ? message.error.code : 'unknown';
        pending.reject(new Error(code === -32601
          ? '当前 Codex CLI 不支持账号额度接口，请升级 Codex CLI。'
          : `Codex ${pending.method} 查询失败（错误码 ${code}）。请检查登录状态、网络及 CLI 配置。`));
      } else if ('result' in message) pending.resolve(message.result);
      else pending.reject(new Error('Codex 响应缺少 result 字段。'));
    }
  }

  private fail(error: Error): void {
    this.failure ??= error;
    for (const pending of this.pending.values()) pending.reject(this.failure);
    this.pending.clear();
  }

  async dispose(): Promise<void> {
    this.signal.removeEventListener('abort', this.abortListener);
    this.fail(new Error('查询已结束。'));
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
  let stage = '查找 CLI';
  const abort = () => controller.abort(new Error('额度查询已取消。'));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error(
    `Codex ${stage}超时（${options.timeoutMs / 1000} 秒）。请检查 CLI 登录状态、配置目录写权限及网络，或增加 codexQuota.requestTimeoutSeconds。`
  )), options.timeoutMs);
  let client: RpcClient | undefined;
  let command: CliCommand | undefined;
  let codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex');
  try {
    command = await resolveCli(options.cliPath);
    if (controller.signal.aborted) throw controller.signal.reason;
    const configuredHome = expandHome(options.codexHome.trim());
    if (configuredHome && !path.isAbsolute(configuredHome)) throw new Error('codexHome 必须是绝对路径或 ~/ 路径。');
    codexHome = configuredHome || codexHome;
    const env: NodeJS.ProcessEnv = { ...process.env, ...(configuredHome ? { CODEX_HOME: configuredHome } : {}) };
    delete env.ELECTRON_RUN_AS_NODE;
    if (command.args.length) env.ELECTRON_RUN_AS_NODE = '1';
    if (command.packageRoot) env.CODEX_MANAGED_PACKAGE_ROOT = command.packageRoot;
    if (controller.signal.aborted) throw controller.signal.reason;
    stage = '启动并初始化 CLI';
    client = new RpcClient(command.executable, command.args, env, controller.signal, () => stage);
    const initialized = await client.request('initialize', {
      clientInfo: { name: 'codex_quota_vscode', title: 'Codex Quota', version },
      capabilities: { experimentalApi: false }
    });
    client.initialized();
    stage = '读取账号';
    const account = parseAccount(await client.request('account/read', { refreshToken: false }));
    stage = '读取额度';
    const quota = account.type === 'chatgpt' ? parseQuota(await client.request('account/rateLimits/read')) : undefined;
    // Reject mixed-account snapshots if the account changes during the quota request.
    if (quota) {
      stage = '确认账号';
      const after = parseAccount(await client.request('account/read', { refreshToken: false }));
      if (JSON.stringify(after) !== JSON.stringify(account)) throw new Error('查询期间账号发生变化，请重新刷新。');
    }
    return {
      account, quota, checkedAt: new Date(),
      cliPath: command.args[0] ?? command.executable,
      codexHome: record(initialized) && typeof initialized.codexHome === 'string'
        ? initialized.codexHome : configuredHome || process.env.CODEX_HOME || path.join(homedir(), '.codex')
    };
  } catch (error) {
    throw new CodexQueryError(error instanceof Error ? error.message : '额度查询失败。', {
      phase: stage, cliPath: command ? command.args[0] ?? command.executable : undefined, codexHome,
      ...(error instanceof ProcessExitError ? { exitCode: error.exitCode, signal: error.signal } : {})
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    await client?.dispose();
  }
}
