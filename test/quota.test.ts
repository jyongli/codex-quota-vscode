import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAccount, parseQuota, quotaText, accountText } from '../src/quota';
import { activeTarget, hostIpAddress, selectedTarget, withTarget } from '../src/environment';

const window = (usedPercent: number, windowDurationMins: number | null) => ({ usedPercent, windowDurationMins, resetsAt: 2_000_000_000 });

test('5 小时与周窗口显示剩余百分比，而不是已使用百分比', () => {
  assert.equal(quotaText(parseQuota({ rateLimits: { primary: window(25, 300), secondary: window(40, 10080) } })), '5 小时 75% · 周 60%');
});

test('仅有周窗口时省略 5 小时；周窗口可以出现在 primary', () => {
  for (const slot of ['primary', 'secondary']) {
    assert.equal(quotaText(parseQuota({ rateLimits: { [slot]: window(12.5, 10080) } })), '周 87.5%');
  }
});

test('按时长识别倒置窗口，不假定 primary 必然为 5 小时', () => {
  assert.equal(quotaText(parseQuota({ rateLimits: { primary: window(30, 10080), secondary: window(0, 300) } })), '5 小时 100% · 周 70%');
});

test('未知、缺失与非目标时长不会伪造额度', () => {
  assert.equal(quotaText(parseQuota({ rateLimits: { primary: window(25, null), secondary: window(40, 15) } })), '周 —');
  assert.equal(quotaText(parseQuota({ rateLimits: { primary: window(25, 300) } })), '5 小时 75% · 周 —');
  assert.equal(quotaText(parseQuota({ rateLimits: { primary: null, secondary: null } })), '周 —');
});

test('优先通用 codex 桶，不混合不同模型额度', () => {
  const quota = parseQuota({ rateLimits: { limitId: 'other', primary: window(5, 300) }, rateLimitsByLimitId: {
    codex: { limitId: 'codex', primary: null, secondary: window(70, 10080) },
    other: { primary: window(5, 300) }
  }, accountId: 'fixture-account' });
  assert.equal(quotaText(quota), '周 30%');
  assert.equal(quota.accountId, 'fixture-account');
  assert.throws(() => parseQuota({ rateLimits: { limitId: 'other', primary: window(5, 300) } }), /其他模型/);
});

test('耗尽、超额、舍入与非法百分比', () => {
  assert.equal(quotaText(parseQuota({ rateLimits: { secondary: window(120, 10080) } })), '周 0%');
  assert.equal(quotaText(parseQuota({ rateLimits: { secondary: window(25.24, 10080) } })), '周 74.8%');
  for (const usedPercent of [NaN, Infinity, -1, '50', undefined]) {
    assert.throws(() => parseQuota({ rateLimits: { primary: { usedPercent, windowDurationMins: 300 } } }), /百分比无效/);
  }
});

test('拒绝无效快照、重复窗口与异常重置时间', () => {
  for (const invalid of [null, {}, { rateLimits: [] }, { rateLimits: { primary: 'bad' } }]) assert.throws(() => parseQuota(invalid));
  assert.throws(() => parseQuota({ rateLimits: { primary: window(1, 300), secondary: window(2, 300) } }), /重复/);
  assert.equal(parseQuota({ rateLimits: { secondary: { ...window(2, 10080), resetsAt: 1e300 } } }).weekly?.resetsAt, undefined);
});

test('账号来源类型明确区分 ChatGPT、API Key、Bedrock 和未登录', () => {
  assert.match(accountText(parseAccount({ account: { type: 'chatgpt', email: 'user@example.test', planType: 'plus' } })), /user@example.test.*ChatGPT.*plus/);
  assert.match(accountText(parseAccount({ account: { type: 'apiKey' } })), /无|不提供/);
  assert.match(accountText(parseAccount({ account: { type: 'amazonBedrock' } })), /Bedrock/);
  assert.match(accountText(parseAccount({ account: null })), /未登录/);
  assert.match(accountText(parseAccount({ account: { type: 'chatgpt', email: null } })), /未提供邮箱/);
  assert.throws(() => parseAccount({}), /格式不兼容/);
  assert.throws(() => parseAccount({ account: { type: 'unknown' } }), /不支持/);
});

test('远程连接中的 UI 宿主仍为本地；只有远程 workspace 宿主为远程', () => {
  assert.equal(activeTarget(false, 'ssh-remote'), 'local');
  assert.equal(activeTarget(true, 'ssh-remote'), 'remote');
  assert.equal(activeTarget(true, undefined), 'local');
});

test('环境切换保留其他扩展设置，不修改原对象', () => {
  const settings = { 'other.extension': ['workspace'] };
  const changed = withTarget(settings, 'jyongli.codex-quota-vscode', 'remote');
  assert.deepEqual(changed['other.extension'], ['workspace']);
  assert.equal(selectedTarget(changed, 'jyongli.codex-quota-vscode'), 'remote');
  assert.equal(selectedTarget(settings, 'jyongli.codex-quota-vscode'), 'local');
  assert.equal(selectedTarget(withTarget(changed, 'jyongli.codex-quota-vscode', 'local'), 'jyongli.codex-quota-vscode'), 'local');
  assert.deepEqual(settings, { 'other.extension': ['workspace'] });
});

test('宿主 IP 排除回环，优先 IPv4，多网卡去重且兼容数字 family', () => {
  assert.equal(hostIpAddress({
    loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    ethernet: [
      { address: 'fe80::1', family: 'IPv6', internal: false },
      { address: '192.168.1.10', family: 'IPv4', internal: false }
    ],
    vpn: [{ address: '10.0.0.2', family: 4, internal: false }],
    duplicate: [{ address: '192.168.1.10', family: 'IPv4', internal: false }],
    unavailable: undefined
  }), '192.168.1.10、10.0.0.2');
});

test('宿主 IP 支持仅 IPv6 和无可用网卡，回环不冒充宿主地址', () => {
  assert.equal(hostIpAddress({ ethernet: [{ address: 'fd00::2', family: 'IPv6', internal: false }] }), 'fd00::2');
  assert.equal(hostIpAddress({}), '未获取到');
  assert.equal(hostIpAddress({ loopback: [{ address: '::1', family: 'IPv6', internal: true }] }), '未获取到');
});
