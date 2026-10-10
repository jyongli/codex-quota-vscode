import { Snapshot } from './cli';
import { fail, LocalizedError, MessageKey } from './i18n';
import { queryRemote } from './remoteClient';
import { REMOTE_PROTOCOL, REMOTE_READY } from './remoteProtocol';

export const INSTALL_EXTENSION = 'workbench.extensions.installExtension';
type Sender = (command: string, argument: unknown) => PromiseLike<unknown>;

function bounded<T>(work: PromiseLike<T>, timeoutMs: number, timeoutKey: MessageKey, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => finish(fail('cancelled'));
    const timer = setTimeout(() => finish(fail(timeoutKey)), timeoutMs);
    let settled = false;
    const finish = (error?: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value!);
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    void Promise.resolve(work).then(value => finish(undefined, value), error => finish(error));
  });
}

function unavailable(error: unknown): boolean {
  return error instanceof LocalizedError && ['remoteUnavailable', 'remoteConnection'].includes(error.translation.key);
}

/** Installs only the bundled archive through VS Code's host-aware VSIX installer. */
export class RemoteSupport {
  private deployment?: Promise<void>;

  constructor(private readonly send: Sender, private readonly archive: unknown,
    private readonly installTimeoutMs = 60000, private readonly readyTimeoutMs = 10000) {}

  install(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(fail('cancelled'));
    if (!this.deployment) {
      // A caller can stop waiting without aborting VS Code's shared installation.
      const deployment = (async () => {
        try { await this.send(INSTALL_EXTENSION, this.archive); }
        catch { throw fail('remoteInstallFailed'); }
        const deadline = Date.now() + this.readyTimeoutMs;
        while (Date.now() < deadline) {
          // executeCommand activates a newly installed extension. Merely listing
          // commands cannot activate it and can miss its unregistered handlers.
          try {
            const ready = await bounded(this.send(REMOTE_READY, undefined), Math.max(1, deadline - Date.now()), 'remoteNotReady') as { protocol?: unknown; ready?: unknown } | undefined;
            if (ready?.protocol === REMOTE_PROTOCOL && ready.ready === true) return;
          } catch { /* The extension registry may still be processing installation. */ }
          await new Promise(resolve => setTimeout(resolve, Math.min(100, Math.max(0, deadline - Date.now()))));
        }
        throw fail('remoteNotReady');
      })();
      this.deployment = deployment;
      void deployment.finally(() => { if (this.deployment === deployment) this.deployment = undefined; }).catch(() => {});
    }
    return bounded(this.deployment, this.installTimeoutMs, 'remoteInstallTimeout', signal);
  }

  async query(remoteName: string, timeoutMs: number, signal: AbortSignal, includePublicIp: boolean,
    preparing: (value: boolean) => void): Promise<Snapshot> {
    try { return await queryRemote(this.send, remoteName, timeoutMs, signal, includePublicIp); }
    catch (error) { if (!unavailable(error) || signal.aborted) throw error; }
    preparing(true);
    try { await this.install(signal); }
    finally { preparing(false); }
    try { return await queryRemote(this.send, remoteName, timeoutMs, signal, includePublicIp); }
    catch (error) { if (unavailable(error)) throw fail('remoteNotReady'); throw error; }
  }
}
