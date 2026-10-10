import * as vscode from 'vscode';
import { CodexQueryError, queryCodex } from './cli';
import { hostIpAddress } from './environment';
import { REMOTE_CANCEL, REMOTE_PROTOCOL, REMOTE_QUERY, RemoteReply, RemoteRequest } from './remoteProtocol';

export function activate(context: vscode.ExtensionContext): void {
  const requests = new Map<string, AbortController>();
  context.subscriptions.push(vscode.commands.registerCommand(REMOTE_QUERY, async (request: RemoteRequest): Promise<RemoteReply> => {
    const origin = { protocol: REMOTE_PROTOCOL, remoteName: vscode.env.remoteName ?? null, hostIp: hostIpAddress() };
    // In a local window, workspace extensions share the local host (reported as UI).
    // In a remote window the provider must actually execute in the remote host.
    if (!vscode.workspace.isTrusted || (!!vscode.env.remoteName && context.extension.extensionKind !== vscode.ExtensionKind.Workspace)) {
      return { ...origin, ok: false, message: '远程查询组件需要在受信任的工作区宿主运行。' };
    }
    if (!request || !/^[a-f0-9-]{36}$/i.test(request.requestId) || requests.has(request.requestId)) {
      return { ...origin, ok: false, message: '远程查询请求无效。' };
    }
    const controller = new AbortController();
    requests.set(request.requestId, controller);
    try {
      const config = vscode.workspace.getConfiguration('codexQuota');
      const snapshot = await queryCodex({
        cliPath: config.get('cliPath', 'codex'), codexHome: config.get('codexHome', ''),
        timeoutMs: Math.max(5000, Math.min(120000, Number(request.timeoutMs) || 60000))
      }, controller.signal);
      return { ...origin, ok: true, snapshot: { ...snapshot, checkedAt: snapshot.checkedAt.toISOString() } };
    } catch (error) {
      return { ...origin, ok: false, message: error instanceof Error ? error.message : '远程额度查询失败。',
        ...(error instanceof CodexQueryError ? { diagnostic: error.diagnostic } : {}) };
    } finally { requests.delete(request.requestId); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand(REMOTE_CANCEL, (request: { requestId: string }) => {
    if (request && typeof request.requestId === 'string') requests.get(request.requestId)?.abort();
  }));
  context.subscriptions.push({ dispose() { for (const controller of requests.values()) controller.abort(); requests.clear(); } });
}
