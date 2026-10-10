import type { QueryDiagnostic, Snapshot } from './cli';

export const REMOTE_QUERY = 'codexQuota.remote.query';
export const REMOTE_CANCEL = 'codexQuota.remote.cancel';
export const REMOTE_PROTOCOL = 1;
export interface RemoteRequest { requestId: string; timeoutMs: number }
export type RemoteReply = {
  protocol: number;
  remoteName: string | null;
  hostIp: string;
} & ({
  ok: true;
  snapshot: Omit<Snapshot, 'checkedAt'> & { checkedAt: string };
} | {
  ok: false;
  message: string;
  diagnostic?: QueryDiagnostic;
});
