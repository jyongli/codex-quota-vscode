import { randomUUID } from 'node:crypto';
import { CodexQueryError, Snapshot } from './cli';
import { REMOTE_CANCEL, REMOTE_PROTOCOL, REMOTE_QUERY, RemoteReply } from './remoteProtocol';
import { fail, LocalizedError } from './i18n';

type CommandSender = (command: string, argument: unknown) => PromiseLike<unknown>;

export function queryRemote(send: CommandSender, remoteName: string, timeoutMs: number, signal: AbortSignal, includePublicIp = false): Promise<Snapshot> {
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
    const abort = () => { cancel(); finish(fail('cancelled')); };
    const timer = setTimeout(() => {
      cancel(); finish(fail('remoteTimeout'));
    }, timeoutMs + 1000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    void Promise.resolve().then(() => send(REMOTE_QUERY, { protocol: REMOTE_PROTOCOL, requestId, timeoutMs, includePublicIp })).then(value => {
      if (settled) return;
      const reply = value as RemoteReply | undefined;
      if (!reply || reply.protocol !== REMOTE_PROTOCOL) {
        finish(fail('remoteUnavailable')); return;
      }
      if (reply.remoteName !== remoteName) {
        finish(fail('remoteWrongHost')); return;
      }
      if (!reply.ok) {
        finish(reply.diagnostic ? new CodexQueryError(reply.translation, reply.diagnostic) : new LocalizedError(reply.translation)); return;
      }
      const checkedAt = new Date(reply.snapshot.checkedAt);
      if (!Number.isFinite(checkedAt.getTime()) || !reply.snapshot.account || typeof reply.hostIp !== 'string') {
        finish(fail('remoteInvalidData')); return;
      }
      finish(undefined, { ...reply.snapshot, checkedAt, hostIp: reply.hostIp });
    }).catch(() => finish(fail('remoteConnection')));
  });
}
