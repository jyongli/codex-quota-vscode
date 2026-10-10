import type { QueryDiagnostic, Snapshot } from './cli';
import type { Message } from './i18n';

export const REMOTE_QUERY = 'codexQuota.remote.query';
export const REMOTE_CANCEL = 'codexQuota.remote.cancel';
export const REMOTE_PROTOCOL = 3;
export interface RemoteRequest { protocol: number; requestId: string; timeoutMs: number; includePublicIp: boolean }
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
  translation: Message;
  diagnostic?: QueryDiagnostic;
});
