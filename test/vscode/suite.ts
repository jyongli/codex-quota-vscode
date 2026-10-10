import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { QuotaApi } from '../../src/extension';
import { REMOTE_PROTOCOL, REMOTE_QUERY, RemoteReply } from '../../src/remoteProtocol';
import { randomUUID } from 'node:crypto';

export async function run(): Promise<void> {
  const home = await mkdtemp(path.join(tmpdir(), 'codex-quota-vscode-'));
  const config = vscode.workspace.getConfiguration('codexQuota');
  const previous = Object.fromEntries(['cliPath', 'codexHome', 'remoteCliPath', 'remoteCodexHome', 'statusBarPosition', 'executionEnvironment'].map(key => [key, config.inspect(key)?.globalValue]));
  try {
    await writeFile(path.join(home, 'scenario.json'), '{}');
    await config.update('cliPath', path.resolve(__dirname, '../../../test/fixtures/codex.cjs'), vscode.ConfigurationTarget.Global);
    await config.update('codexHome', home, vscode.ConfigurationTarget.Global);
    await config.update('statusBarPosition', 'right', vscode.ConfigurationTarget.Global);
    await config.update('statusBarPosition', 'right', vscode.ConfigurationTarget.Workspace);
    await config.update('executionEnvironment', 'local', vscode.ConfigurationTarget.Global);
    const extension = vscode.extensions.getExtension<QuotaApi>('jyongli.codex-quota-vscode');
    assert.ok(extension, 'extension must be discovered');
    const api = await extension.activate();
    await api.refresh();
    assert.equal(api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    assert.match(api.getState().tooltip, /fixture@example.test/);
    assert.match(api.getState().tooltip, /IP 地址：.+/);
    assert.match(api.getState().tooltip, /刷新时间间隔：5 分钟（300 秒）/);
    assert.doesNotMatch(api.getState().tooltip, /数据来源：|账号来源：|CLI：|Codex 配置目录：|凭据由 Codex/);
    console.log('PASS: extension activation, real child-process quota, compact tooltip with host IP and refresh interval');
    await config.update('statusBarPosition', 'left', vscode.ConfigurationTarget.Global);
    await Promise.race([
      vscode.commands.executeCommand('codexQuota.togglePosition'),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Position command did not complete')), 10000); timer.unref(); })
    ]);
    assert.equal(api.getState().alignment, 'left');
    assert.equal(config.inspect('statusBarPosition')?.workspaceValue, 'left');
    console.log('PASS: status bar position change despite a workspace override');
    await writeFile(path.join(home, 'scenario.json'), JSON.stringify({ quota: { rateLimits: { secondary: { usedPercent: 10, windowDurationMins: 10080 } } } }));
    await vscode.commands.executeCommand('codexQuota.refresh');
    assert.equal(api.getState().text, 'Codex [本地] 周 90%');
    console.log('PASS: weekly-only status');
    await writeFile(path.join(home, 'scenario.json'), JSON.stringify({ account: { type: 'apiKey' } }));
    await vscode.commands.executeCommand('codexQuota.refresh');
    assert.match(api.getState().text, /API Key/);
    console.log('PASS: API-key account has no fabricated subscription quota');
    await writeFile(path.join(home, 'scenario.json'), JSON.stringify({ exitMethod: 'initialize', stderr: 'TOML parse error SENSITIVE_MOCK_TOKEN' }));
    await vscode.commands.executeCommand('codexQuota.refresh');
    assert.match(api.getState().text, /查询失败/);
    assert.match(api.getState().tooltip, /退出码 4/);
    assert.ok(!api.getState().tooltip.includes('SENSITIVE_MOCK_TOKEN'));
    await vscode.commands.executeCommand('codexQuota.showDiagnostics');
    console.log('PASS: startup failure diagnostics and output command in the real VS Code host');
    const remoteHome = path.join(home, 'remote account');
    await mkdir(remoteHome);
    await writeFile(path.join(remoteHome, 'scenario.json'), JSON.stringify({ account: { type: 'chatgpt', email: 'provider@example.test', planType: 'pro' } }));
    await config.update('remoteCliPath', path.resolve(__dirname, '../../../test/fixtures/codex.cjs'), vscode.ConfigurationTarget.Global);
    await config.update('remoteCodexHome', remoteHome, vscode.ConfigurationTarget.Global);
    assert.ok(vscode.extensions.getExtension('jyongli.codex-quota-remote'), 'remote companion must be discovered');
    const oldReply = await vscode.commands.executeCommand<RemoteReply>(REMOTE_QUERY, { protocol: 1, requestId: randomUUID(), timeoutMs: 5000 });
    assert.equal(oldReply.ok, false, 'old clients must not query using the changed settings contract');
    const reply = await vscode.commands.executeCommand<RemoteReply>(REMOTE_QUERY, { protocol: REMOTE_PROTOCOL, requestId: randomUUID(), timeoutMs: 5000 });
    assert.equal(reply.protocol, REMOTE_PROTOCOL);
    assert.equal(reply.ok, true, reply.ok ? '' : reply.message);
    assert.equal(reply.remoteName, vscode.env.remoteName ?? null);
    assert.ok(reply.hostIp);
    if (reply.ok) {
      assert.equal(reply.snapshot.account.type, 'chatgpt');
      assert.equal(reply.snapshot.codexHome, remoteHome);
      assert.deepEqual(reply.snapshot.account, { type: 'chatgpt', email: 'provider@example.test', planType: 'pro' });
      assert.equal(typeof reply.snapshot.checkedAt, 'string');
    }
    await writeFile(path.join(home, 'scenario.json'), '{}');
    await vscode.commands.executeCommand('codexQuota.refresh');
    assert.match(api.getState().tooltip, /fixture@example.test/);
    assert.equal(api.getState().snapshot?.codexHome, home);
    console.log('PASS: paired extensions exchange serialized queries and isolate accounts despite shared configuration');
    if (process.env.CODEX_QUOTA_NATIVE_CLI) {
      const nativeHome = path.join(home, 'native home 中文 with spaces');
      await mkdir(nativeHome);
      await config.update('cliPath', process.env.CODEX_QUOTA_NATIVE_CLI, vscode.ConfigurationTarget.Global);
      await config.update('codexHome', nativeHome, vscode.ConfigurationTarget.Global);
      await api.refresh();
      assert.match(api.getState().text, /未登录/);
      console.log('PASS: real VS Code extension host launches the official npm Codex CLI and reads an isolated unsigned-in account');
    }
  } finally {
    await config.update('statusBarPosition', undefined, vscode.ConfigurationTarget.Workspace);
    for (const [key, value] of Object.entries(previous)) await config.update(key, value, vscode.ConfigurationTarget.Global);
    await rm(home, { recursive: true, force: true });
  }
}
