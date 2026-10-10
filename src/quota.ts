import { fail, Language, t } from './i18n';
export interface QuotaWindow {
  remainingPercent: number;
  resetsAt?: number;
}

export interface Quota {
  fiveHour?: QuotaWindow;
  weekly?: QuotaWindow;
  accountId?: string;
  bucket: string;
}

export type Account =
  | { type: 'chatgpt'; email: string | null; planType: string }
  | { type: 'apiKey' }
  | { type: 'amazonBedrock' }
  | { type: 'signedOut' };

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAccount(value: unknown): Account {
  if (!record(value) || !('account' in value)) throw fail('accountFormat');
  if (value.account === null) return { type: 'signedOut' };
  const account = value.account;
  if (!record(account)) throw fail('invalidAccount');
  if (account.type === 'chatgpt') {
    return {
      type: 'chatgpt', email: typeof account.email === 'string' ? account.email : null,
      planType: typeof account.planType === 'string' ? account.planType : 'unknown'
    };
  }
  if (account.type === 'apiKey' || account.type === 'amazonBedrock') return { type: account.type };
  throw fail('unsupportedAccount');
}

export function parseQuota(value: unknown): Quota {
  if (!record(value)) throw fail('invalidQuota');
  const buckets = value.rateLimitsByLimitId;
  // Prefer the general Codex bucket. Never combine an unrelated model bucket with it.
  const snapshot = record(buckets) && record(buckets.codex) ? buckets.codex : value.rateLimits;
  if (!record(snapshot)) throw fail('missingQuota');
  if (typeof snapshot.limitId === 'string' && snapshot.limitId !== 'codex') {
    throw fail('otherModel');
  }
  const quota: Quota = { bucket: 'codex' };
  if (typeof value.accountId === 'string') quota.accountId = value.accountId;
  for (const candidate of [snapshot.primary, snapshot.secondary]) {
    if (candidate == null) continue;
    if (!record(candidate)) throw fail('windowFormat');
    const duration = candidate.windowDurationMins;
    if (duration !== 300 && duration !== 10_080) continue;
    if (typeof candidate.usedPercent !== 'number' || !Number.isFinite(candidate.usedPercent) || candidate.usedPercent < 0) {
      throw fail('invalidPercent');
    }
    const window: QuotaWindow = { remainingPercent: Math.max(0, 100 - candidate.usedPercent) };
    if (typeof candidate.resetsAt === 'number' && Number.isFinite(candidate.resetsAt) && candidate.resetsAt > 0 && candidate.resetsAt <= 8.64e12) {
      window.resetsAt = candidate.resetsAt;
    }
    const key = duration === 300 ? 'fiveHour' : 'weekly';
    if (quota[key]) throw fail('duplicateWindow');
    quota[key] = window;
  }
  return quota;
}

export function percent(window: QuotaWindow | undefined): string {
  if (!window) return '—';
  return `${Math.round(window.remainingPercent * 10) / 10}%`;
}

export function quotaText(quota: Quota, language: Language = 'zh-CN'): string {
  return quota.fiveHour
    ? t(language, 'quotaBoth', { five: percent(quota.fiveHour), weekly: percent(quota.weekly) })
    : t(language, 'quotaWeekly', { weekly: percent(quota.weekly) });
}

export function accountText(account: Account, language: Language = 'zh-CN'): string {
  switch (account.type) {
    case 'chatgpt': return t(language, 'chatgptAccount', { email: account.email ?? t(language, 'emailMissing'), plan: account.planType === 'unknown' ? t(language, 'unknown') : account.planType });
    case 'apiKey': return t(language, 'apiKeyAccount');
    case 'amazonBedrock': return t(language, 'bedrockAccount');
    case 'signedOut': return t(language, 'signedOutAccount');
  }
}
