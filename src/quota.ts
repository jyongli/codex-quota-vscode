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
  if (!record(value) || !('account' in value)) throw new Error('账号响应格式不兼容，请更新 Codex CLI。');
  if (value.account === null) return { type: 'signedOut' };
  const account = value.account;
  if (!record(account)) throw new Error('Codex 返回了无效的账号信息。');
  if (account.type === 'chatgpt') {
    return {
      type: 'chatgpt', email: typeof account.email === 'string' ? account.email : null,
      planType: typeof account.planType === 'string' ? account.planType : 'unknown'
    };
  }
  if (account.type === 'apiKey' || account.type === 'amazonBedrock') return { type: account.type };
  throw new Error('当前 Codex 账号类型尚不支持。');
}

export function parseQuota(value: unknown): Quota {
  if (!record(value)) throw new Error('Codex 返回了无效的额度信息。');
  const buckets = value.rateLimitsByLimitId;
  // Prefer the general Codex bucket. Never combine an unrelated model bucket with it.
  const snapshot = record(buckets) && record(buckets.codex) ? buckets.codex : value.rateLimits;
  if (!record(snapshot)) throw new Error('Codex 未返回额度快照。');
  if (typeof snapshot.limitId === 'string' && snapshot.limitId !== 'codex') {
    throw new Error('接口只返回了其他模型额度，未返回通用 Codex 额度。');
  }
  const quota: Quota = { bucket: 'codex' };
  if (typeof value.accountId === 'string') quota.accountId = value.accountId;
  for (const candidate of [snapshot.primary, snapshot.secondary]) {
    if (candidate == null) continue;
    if (!record(candidate)) throw new Error('额度窗口格式不兼容。');
    const duration = candidate.windowDurationMins;
    if (duration !== 300 && duration !== 10_080) continue;
    if (typeof candidate.usedPercent !== 'number' || !Number.isFinite(candidate.usedPercent) || candidate.usedPercent < 0) {
      throw new Error('额度使用百分比无效。');
    }
    const window: QuotaWindow = { remainingPercent: Math.max(0, 100 - candidate.usedPercent) };
    if (typeof candidate.resetsAt === 'number' && Number.isFinite(candidate.resetsAt) && candidate.resetsAt > 0 && candidate.resetsAt <= 8.64e12) {
      window.resetsAt = candidate.resetsAt;
    }
    const key = duration === 300 ? 'fiveHour' : 'weekly';
    if (quota[key]) throw new Error('接口返回了重复的额度窗口。');
    quota[key] = window;
  }
  return quota;
}

export function percent(window: QuotaWindow | undefined): string {
  if (!window) return '—';
  return `${Math.round(window.remainingPercent * 10) / 10}%`;
}

export function quotaText(quota: Quota): string {
  return quota.fiveHour
    ? `5 小时 ${percent(quota.fiveHour)} · 周 ${percent(quota.weekly)}`
    : `周 ${percent(quota.weekly)}`;
}

export function accountText(account: Account): string {
  switch (account.type) {
    case 'chatgpt': return `${account.email ?? '接口未提供邮箱'}（ChatGPT / ${account.planType}）`;
    case 'apiKey': return 'API Key（不提供 ChatGPT 订阅额度）';
    case 'amazonBedrock': return 'Amazon Bedrock（不提供 ChatGPT 订阅额度）';
    case 'signedOut': return '未登录 ChatGPT；请在所选环境运行 codex login';
  }
}
