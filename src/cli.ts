import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, mkdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { Account, Quota, parseAccount, parseQuota, record } from './quota';

export interface QueryOptions {
  cliPath: string;
  codexHome: string;
  timeoutMs: number;
  runtimeDirectory?: string;
}

export interface Snapshot {
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

export async function resolveCli(command: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform): Promise<{ executable: string; args: string[] }> {
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
    found = entry;
  }
  return /\.[cm]?js$/i.test(found)
    ? { executable: process.execPath, args: [found] }
    : { executable: found, args: [] };
}

class RpcClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; method: string }>();
  private buffer = '';
  private nextId = 1;
  private failure?: Error;
  private closed = false;
  private readonly abortListener: () => void;

  constructor(executable: string, args: string[], appServerArgs: string[], env: NodeJS.ProcessEnv, private readonly signal: AbortSignal) {
    this.child = spawn(executable, [...args, 'app-server', ...appServerArgs], {
      cwd: homedir(), env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.receive(chunk));
    // Drain stderr, but never expose it: upstream output may contain credentials.
    this.child.stderr.resume();
    this.child.on('error', () => this.fail(new Error('无法启动 Codex CLI；请检查可执行文件和权限。')));
    this.child.stdin.on('error', () => this.fail(new Error('Codex CLI 输入通道已关闭。')));
    this.child.on('close', () => {
      this.closed = true;
      this.fail(new Error('Codex app-server 提前退出，请更新 CLI 或检查配置。'));
    });
    this.abortListener = () => this.fail(new Error('额度查询已取消或超时。'));
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
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, options.timeoutMs);
  let client: RpcClient | undefined;
  try {
    const command = await resolveCli(options.cliPath);
    if (controller.signal.aborted) throw new Error('额度查询已取消或超时。');
    const configuredHome = expandHome(options.codexHome.trim());
    if (configuredHome && !path.isAbsolute(configuredHome)) throw new Error('codexHome 必须是绝对路径或 ~/ 路径。');
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...(configuredHome ? { CODEX_HOME: configuredHome } : {}) };
    const appServerArgs: string[] = [];
    if (options.runtimeDirectory) {
      if (!path.isAbsolute(options.runtimeDirectory)) throw new Error('CLI 辅助数据目录必须是绝对路径。');
      await mkdir(options.runtimeDirectory, { recursive: true, mode: 0o700 });
      // Isolate the helper's database/logs while preserving the existing auth home.
      appServerArgs.push('-c', `sqlite_home=${JSON.stringify(options.runtimeDirectory)}`,
        '-c', `log_dir=${JSON.stringify(options.runtimeDirectory)}`);
    }
    if (controller.signal.aborted) throw new Error('额度查询已取消或超时。');
    client = new RpcClient(command.executable, command.args, appServerArgs, env, controller.signal);
    const initialized = await client.request('initialize', {
      clientInfo: { name: 'codex_quota_vscode', title: 'Codex Quota', version: '0.1.0' },
      capabilities: { experimentalApi: false }
    });
    client.initialized();
    const account = parseAccount(await client.request('account/read', { refreshToken: false }));
    const quota = account.type === 'chatgpt' ? parseQuota(await client.request('account/rateLimits/read')) : undefined;
    // Reject mixed-account snapshots if the account changes during the quota request.
    if (quota) {
      const after = parseAccount(await client.request('account/read', { refreshToken: false }));
      if (JSON.stringify(after) !== JSON.stringify(account)) throw new Error('查询期间账号发生变化，请重新刷新。');
    }
    return {
      account, quota, checkedAt: new Date(),
      cliPath: command.args[0] ?? command.executable,
      codexHome: record(initialized) && typeof initialized.codexHome === 'string'
        ? initialized.codexHome : configuredHome || process.env.CODEX_HOME || path.join(homedir(), '.codex')
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    await client?.dispose();
  }
}
