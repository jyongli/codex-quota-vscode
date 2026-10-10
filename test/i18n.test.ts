import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorMessage, fail, message, resolveLanguage, text } from '../src/i18n';
import { accountText, parseAccount, parseQuota, quotaText } from '../src/quota';

test('自动语言跟随 VS Code，明确选择覆盖界面语言', () => {
  for (const locale of ['zh', 'zh-cn', 'zh-TW', 'zh-HK']) assert.equal(resolveLanguage('auto', locale), 'zh-CN');
  for (const locale of ['en', 'en-US', 'de', undefined]) assert.equal(resolveLanguage('auto', locale), 'en');
  assert.equal(resolveLanguage('zh-CN', 'en'), 'zh-CN');
  assert.equal(resolveLanguage('en', 'zh-cn'), 'en');
});

test('可序列化错误保留阶段和分类，重译不泄露未知原始错误', () => {
  const error = fail('processExit', { phase: message('phaseQuota'), status: 4, signal: '', hint: message('databaseHint') });
  const translation = JSON.parse(JSON.stringify(error.translation));
  assert.match(text('zh-CN', translation), /读取额度.*退出码 4.*数据库/);
  assert.match(text('en', translation), /quota read.*exit code 4.*database/);
  assert.equal(text('en', errorMessage(new Error('SENSITIVE_MOCK_TOKEN'))), 'Quota query failed.');
});

test('英文额度与账号保留原始百分比和账号数据，不伪造未知窗口', () => {
  const quota = parseQuota({ rateLimits: { primary: { usedPercent: 25, windowDurationMins: 300 } } });
  assert.equal(quotaText(quota, 'en'), '5h 75% · Week —');
  assert.equal(quotaText(parseQuota({ rateLimits: { secondary: { usedPercent: 12.5, windowDurationMins: 10080 } } }), 'en'), 'Week 87.5%');
  assert.equal(accountText(parseAccount({ account: { type: 'chatgpt', email: '中文@example.test', planType: 'pro' } }), 'en'), '中文@example.test (ChatGPT / pro)');
  assert.match(accountText(parseAccount({ account: null }), 'en'), /Not signed in.*codex login/);
  assert.match(accountText(parseAccount({ account: { type: 'apiKey' } }), 'en'), /no ChatGPT subscription/);
});
