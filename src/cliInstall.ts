import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveCli } from './cli';
import { fail, LocalizedError, message } from './i18n';

interface InstallOptions {
  cliPath: string;
  storagePath: string;
  autoInstall: boolean;
  onInstalling?: () => void;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

// Resolve npm's JavaScript entry instead of invoking npm.cmd through a shell.
export async function resolveNpm(env: NodeJS.ProcessEnv = process.env, platform = process.platform): Promise<string> {
  const windows = platform === 'win32';
  for (const directory of (env.PATH ?? env.Path ?? '').split(windows ? ';' : path.delimiter).filter(Boolean)) {
    if (!path.isAbsolute(directory)) continue;
    const launcher = path.join(directory, windows ? 'npm.cmd' : 'npm');
    try {
      const resolved = await realpath(launcher);
      const entry = path.basename(resolved) === 'npm-cli.js' ? resolved
        : path.join(path.dirname(launcher), 'node_modules', 'npm', 'bin', 'npm-cli.js');
      await access(entry);
      return await realpath(entry);
    } catch { /* Try another installation in PATH. */ }
  }
  throw fail('npmMissing');
}

function installHint(stderr: string): ReturnType<typeof message> {
  if (/EACCES|EPERM|EROFS|permission|access.*denied/i.test(stderr)) return message('installPermission');
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONN|certificate|CERT_|proxy|network|TLS/i.test(stderr)) return message('installNetwork');
  if (/EBADPLATFORM|unsupported platform|unsupported architecture/i.test(stderr)) return message('installPlatform');
  return message('installRetry');
}

async function installPackage(npm: string, destination: string, cache: string, env: NodeJS.ProcessEnv, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw signal.reason;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [npm, 'install', '--prefix', destination, '--cache', cache,
      '--registry=https://registry.npmjs.org', '--global=false', '--ignore-scripts', '--include=optional', '--no-audit', '--no-fund',
      '--package-lock=false', '@openai/codex@latest'], {
      cwd: destination, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, shell: false, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      child.kill();
      killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
    };
    signal.addEventListener('abort', abort, { once: true });
    child.stdout.resume();
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-16_384); });
    child.once('error', () => reject(fail('npmStartFailed')));
    child.once('close', code => {
      signal.removeEventListener('abort', abort);
      if (killTimer) clearTimeout(killTimer);
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve();
      else reject(fail('installFailed', { code: code ?? 'unknown', hint: installHint(stderr) }));
      stderr = '';
    });
    if (signal.aborted) abort();
  });
}

async function installedEntry(directory: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  const entry = path.join(directory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  try {
    const manifest = JSON.parse(await readFile(path.join(directory, 'node_modules', '@openai', 'codex', 'package.json'), 'utf8')) as { name?: unknown };
    if (manifest.name !== '@openai/codex') return undefined;
    const targets: Record<string, string> = {
      'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl',
      'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin',
      'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc'
    };
    const platform = `${process.platform}-${process.arch}`;
    if (!targets[platform]) return undefined;
    const roots = [path.join(path.dirname(path.dirname(entry)), 'vendor')];
    try { roots.unshift(path.join(path.dirname(createRequire(entry).resolve(`@openai/codex-${platform}/package.json`)), 'vendor')); } catch { /* Older layout. */ }
    let binary = false;
    for (const root of roots) for (const bin of ['bin', 'codex']) {
      try { await access(path.join(root, targets[platform], bin, process.platform === 'win32' ? 'codex.exe' : 'codex'), process.platform === 'win32' ? constants.F_OK : constants.X_OK); binary = true; } catch { /* Next layout. */ }
    }
    if (!binary) return undefined;
    await resolveCli(entry, env);
    return entry;
  } catch { return undefined; }
}

export async function ensureCli(options: InstallOptions, signal: AbortSignal): Promise<string> {
  const env = options.env ?? process.env;
  if (signal.aborted) throw fail('cancelled');
  try {
    await resolveCli(options.cliPath, env);
    return options.cliPath;
  } catch (error) {
    // Explicit paths and broken/unsupported installations retain their useful errors.
    if (!(error instanceof LocalizedError) || error.translation.key !== 'cliMissing'
      || options.cliPath.trim() !== 'codex') throw error;
  }
  const destination = path.join(options.storagePath, 'codex-cli');
  const existing = await installedEntry(destination, env);
  if (existing) return existing;
  if (!options.autoInstall) throw fail('cliMissing');
  options.onInstalling?.();
  const controller = new AbortController();
  const abort = () => controller.abort(fail('cancelled'));
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timeoutMs = options.timeoutMs ?? 180_000;
  const timer = setTimeout(() => controller.abort(fail('installTimeout')), timeoutMs);
  const lock = path.join(options.storagePath, 'codex-cli-install.lock');
  let locked = false;
  let staging: string | undefined;
  try {
    const npm = await resolveNpm(env);
    await mkdir(options.storagePath, { recursive: true });
    // A per-host lock also coalesces first use in different VS Code windows.
    while (!locked) {
      if (controller.signal.aborted) throw controller.signal.reason;
      const ready = await installedEntry(destination, env);
      if (ready) return ready;
      try {
        const file = await open(lock, 'wx');
        locked = true;
        await file.close();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try {
          if (Date.now() - (await stat(lock)).mtimeMs > 360_000) await rm(lock, { force: true });
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        await delay(200, undefined, { signal: controller.signal });
      }
    }
    staging = await mkdtemp(path.join(options.storagePath, 'codex-cli-install-'));
    await installPackage(npm, staging, path.join(options.storagePath, 'npm-cache'), env, controller.signal);
    if (!await installedEntry(staging, env)) throw fail('installIncomplete');
    if (controller.signal.aborted) throw controller.signal.reason;
    // Only a complete validated installation becomes visible to another window.
    await rm(destination, { recursive: true, force: true });
    await rename(staging, destination);
    return path.join(destination, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof LocalizedError) throw error;
    throw fail('installStorage');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    if (staging) await rm(staging, { recursive: true, force: true }).catch(() => {});
    if (locked) await rm(lock, { force: true }).catch(() => {});
  }
}
