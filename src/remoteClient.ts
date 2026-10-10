import { randomUUID } from 'node:crypto';
import { CodexQueryError, Snapshot } from './cli';
import { REMOTE_CANCEL, REMOTE_PROTOCOL, REMOTE_QUERY, RemoteReply } from './remoteProtocol';

type CommandSender = (command: string, argument: unknown) => PromiseLike<unknown>;

export function queryRemote(send: CommandSender, remoteName: string, timeoutMs: number, signal: AbortSignal): Promise<Snapshot> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    let settled = false;
    const cancel = () => { void Promise.resolve().then(() => send(REMOTE_CANCEL, { requestId })).catch(() => {}); };
    const finish = (error?: Error, snapshot?: Snapshot) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(snapshot!);
    };
    const abort = () => { cancel(); finish(new Error('额度查询已取消。')); };
    const timer = setTimeout(() => {
      cancel(); finish(new Error('远程额度查询超时；请检查远程连接和 Codex Quota Remote 查询组件。'));
    }, timeoutMs + 1000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    void Promise.resolve().then(() => send(REMOTE_QUERY, { requestId, timeoutMs })).then(value => {
      if (settled) return;
      const reply = value as RemoteReply | undefined;
      if (!reply || reply.protocol !== REMOTE_PROTOCOL) {
        finish(new Error('远程查询组件未安装、未启用或版本不兼容；请在远程端安装同版本的 Codex Quota Remote。')); return;
      }
      if (reply.remoteName !== remoteName) {
        finish(new Error('查询组件未在当前远程宿主运行；请在远程端安装 Codex Quota Remote。')); return;
      }
      if (!reply.ok) {
        finish(reply.diagnostic ? new CodexQueryError(reply.message, reply.diagnostic) : new Error(reply.message)); return;
      }
      const checkedAt = new Date(reply.snapshot.checkedAt);
      if (!Number.isFinite(checkedAt.getTime()) || !reply.snapshot.account || typeof reply.hostIp !== 'string') {
        finish(new Error('远程查询组件返回的数据无效。')); return;
      }
      finish(undefined, { ...reply.snapshot, checkedAt, hostIp: reply.hostIp });
    }).catch(() => finish(new Error('无法连接远程查询组件；请在远程端安装并启用 Codex Quota Remote。')));
  });
}
