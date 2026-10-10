import * as vscode from 'vscode';
import { CodexQueryError, queryCodex } from './cli';
import { hostIpAddress } from './environment';
import { REMOTE_CANCEL, REMOTE_PROTOCOL, REMOTE_QUERY, RemoteReply, RemoteRequest } from './remoteProtocol';
import { errorMessage, fail, MessageKey, text } from './i18n';
import { getPublicIp } from './publicIp';

export function activate(context: vscode.ExtensionContext): void {
  const requests = new Map<string, AbortController>();
  context.subscriptions.push(vscode.commands.registerCommand(REMOTE_QUERY, async (request: RemoteRequest): Promise<RemoteReply> => {
    const origin = { protocol: REMOTE_PROTOCOL, remoteName: vscode.env.remoteName ?? null, hostIp: hostIpAddress() };
    const reject = (key: MessageKey): RemoteReply => {
      const error = fail(key);
      return { ...origin, ok: false, message: error.message, translation: error.translation };
    };
    // In a local window, workspace extensions share the local host (reported as UI).
    // In a remote window the provider must actually execute in the remote host.
    if (!vscode.workspace.isTrusted || (!!vscode.env.remoteName && context.extension.extensionKind !== vscode.ExtensionKind.Workspace)) {
      return reject('remoteTrust');
    }
    if (!request || request.protocol !== REMOTE_PROTOCOL) {
      return reject('remoteProtocol');
    }
    if (!/^[a-f0-9-]{36}$/i.test(request.requestId) || requests.has(request.requestId)) {
      return reject('remoteRequest');
    }
    const controller = new AbortController();
    requests.set(request.requestId, controller);
    try {
      const config = vscode.workspace.getConfiguration('codexQuota');
      const [snapshot, publicIp] = await Promise.all([queryCodex({
        cliPath: config.get('remoteCliPath', 'codex'), codexHome: config.get('remoteCodexHome', ''),
        timeoutMs: Math.max(5000, Math.min(120000, Number(request.timeoutMs) || 60000))
      }, controller.signal), request.includePublicIp === true ? getPublicIp(controller.signal) : Promise.resolve(undefined)]);
      return { ...origin, ok: true, snapshot: { ...snapshot, publicIp, checkedAt: snapshot.checkedAt.toISOString() } };
    } catch (error) {
      const translation = errorMessage(error);
      return { ...origin, ok: false, message: text('zh-CN', translation), translation,
        ...(error instanceof CodexQueryError ? { diagnostic: error.diagnostic } : {}) };
    } finally { controller.abort(); requests.delete(request.requestId); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand(REMOTE_CANCEL, (request: { requestId: string }) => {
    if (request && typeof request.requestId === 'string') requests.get(request.requestId)?.abort();
  }));
  context.subscriptions.push({ dispose() { for (const controller of requests.values()) controller.abort(); requests.clear(); } });
}
