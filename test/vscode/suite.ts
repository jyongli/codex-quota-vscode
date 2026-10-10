import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { QuotaApi } from '../../src/extension';
import { ReadableStream } from 'node:stream/web';

async function chooseLanguage(index: number): Promise<void> {
  const command = vscode.commands.executeCommand('codexQuota.selectLanguage');
  await new Promise(resolve => setTimeout(resolve, 250));
  for (let step = 0; step < index; step++) await vscode.commands.executeCommand('workbench.action.quickOpenSelectNext');
  await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
  await Promise.race([
    command,
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Language menu command did not complete')), 10000); timer.unref(); })
  ]);
}

export async function run(): Promise<void> {
  const home = await mkdtemp(path.join(tmpdir(), 'codex-quota-vscode-'));
  const config = vscode.workspace.getConfiguration('codexQuota');
  const previous = Object.fromEntries(['cliPath', 'codexHome', 'remoteCliPath', 'remoteCodexHome', 'statusBarPosition', 'language', 'showPublicIp'].map(key => [key, config.inspect(key)?.globalValue]));
  try {
    await config.update('language', 'zh-CN', vscode.ConfigurationTarget.Global);
    await config.update('showPublicIp', false, vscode.ConfigurationTarget.Global);
    await writeFile(path.join(home, 'scenario.json'), '{}');
    await config.update('cliPath', path.resolve(__dirname, '../../../test/fixtures/codex.cjs'), vscode.ConfigurationTarget.Global);
    await config.update('codexHome', home, vscode.ConfigurationTarget.Global);
    await config.update('statusBarPosition', 'right', vscode.ConfigurationTarget.Global);
    await config.update('statusBarPosition', 'right', vscode.ConfigurationTarget.Workspace);
    const extension = vscode.extensions.getExtension<QuotaApi>('jyongli.codex-quota-vscode');
    assert.ok(extension, 'extension must be discovered');
    // The API reports UI for a local process even when the manifest prefers
    // the workspace host; Workspace means it is executing remotely.
    assert.equal(extension.extensionKind, vscode.ExtensionKind.UI);
    assert.deepEqual(extension.packageJSON.extensionKind, ['workspace']);
    assert.equal(extension.packageJSON.contributes.configuration.properties['codexQuota.cliPath'].scope, 'machine');
    const api = await extension.activate();
    assert.equal(api.getState().target, 'local');
    assert.ok(!(await vscode.commands.getCommands(true)).includes('codexQuota.selectEnvironment'));
    assert.equal(vscode.extensions.getExtension('jyongli.codex-quota-remote'), undefined);
    console.log('PASS: one workspace extension uses its installed host; no environment selector or companion');
    await api.refresh();
    assert.equal(api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    assert.match(api.getState().tooltip, /fixture@example.test/);
    assert.match(api.getState().tooltip, /IP 地址：.+/);
    assert.match(api.getState().tooltip, /刷新时间间隔：5 分钟（300 秒）/);
    assert.doesNotMatch(api.getState().tooltip, /数据来源：|账号来源：|CLI：|Codex 配置目录：|凭据由 Codex/);
    console.log('PASS: extension activation, real child-process quota, compact tooltip with host IP and refresh interval');
    const checkedAt = api.getState().snapshot?.checkedAt;
    await chooseLanguage(2);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(api.getState().text, 'Codex [Local] 5h 75% · Week 60%');
    assert.match(api.getState().tooltip, /Account: fixture@example.test/);
    assert.equal(api.getState().snapshot?.checkedAt, checkedAt);
    await config.update('language', 'zh-CN', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('PASS: actual language menu switches immediately and preserves the quota snapshot in the real VS Code host');
    await config.update('language', 'zh-CN', vscode.ConfigurationTarget.Workspace);
    const settingsFile = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, '.vscode', 'settings.json').fsPath;
    const validSettings = await readFile(settingsFile, 'utf8');
    const invalidSettings = validSettings + '\nINVALID_JSON_FOR_LANGUAGE_TEST\n';
    try {
      await writeFile(settingsFile, invalidSettings);
      await new Promise(resolve => setTimeout(resolve, 300));
      await chooseLanguage(2);
      assert.equal(api.getState().text, 'Codex [Local] 5h 75% · Week 60%');
      assert.equal(api.getState().snapshot?.checkedAt, checkedAt);
      assert.equal(vscode.workspace.getConfiguration('codexQuota').get('language'), 'zh-CN', 'the failed settings update must not be mistaken for a successful write');
      assert.equal(await readFile(settingsFile, 'utf8'), invalidSettings, 'do not overwrite invalid user settings');
    } finally {
      await writeFile(settingsFile, validSettings);
      await vscode.commands.executeCommand('notifications.clearAll');
      await chooseLanguage(1);
      await config.update('language', undefined, vscode.ConfigurationTarget.Workspace);
    }
    assert.match(api.getState().text, /Codex \[本地\]/);
    console.log('PASS: language menu still switches with invalid settings, preserves quota and leaves the settings file intact');
    const originalFetch = globalThis.fetch;
    let publicIpCalls = 0;
    globalThis.fetch = async input => {
      assert.equal(input, 'https://api64.ipify.org');
      publicIpCalls++;
      return { ok: true, body: new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('203.0.113.19')); controller.close(); } }) } as Response;
    };
    try {
      await config.update('showPublicIp', true, vscode.ConfigurationTarget.Global);
      await new Promise(resolve => setTimeout(resolve, 100));
      await api.refresh();
      assert.equal(api.getState().snapshot?.publicIp, '203.0.113.19');
      assert.match(api.getState().tooltip, /IP 地址：.+\n公网 IP：203\.0\.113\.19/);
      assert.equal(publicIpCalls, 1, 'the next quota refresh must reuse the cached public IP');
      await config.update('showPublicIp', false, vscode.ConfigurationTarget.Global);
      await new Promise(resolve => setTimeout(resolve, 100));
      await api.refresh();
      assert.doesNotMatch(api.getState().tooltip, /公网 IP/);
      assert.equal(publicIpCalls, 1);
    } finally { globalThis.fetch = originalFetch; }
    console.log('PASS: public IP display, cache and disable setting in the real VS Code host');
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
    await config.update('language', 'en', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.match(api.getState().tooltip, /CLI startup and initialization.*exit code 4/);
    assert.doesNotMatch(api.getState().tooltip, /查询失败|阶段|错误/);
    await config.update('language', 'zh-CN', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('PASS: startup failure diagnostics and output command in the real VS Code host');
    await writeFile(path.join(home, 'scenario.json'), '{}');
    await config.update('remoteCliPath', 'missing-legacy-cli', vscode.ConfigurationTarget.Global);
    await config.update('remoteCodexHome', path.join(home, 'unused legacy directory'), vscode.ConfigurationTarget.Global);
    await api.refresh();
    assert.match(api.getState().tooltip, /fixture@example.test/);
    assert.equal(api.getState().snapshot?.codexHome, home);
    assert.equal(vscode.extensions.getExtension('jyongli.codex-quota-remote'), undefined);
    console.log('PASS: the installed local extension queries its own CLI and ignores legacy remote settings');
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
    await config.update('language', undefined, vscode.ConfigurationTarget.Workspace);
    await config.update('statusBarPosition', undefined, vscode.ConfigurationTarget.Workspace);
    for (const [key, value] of Object.entries(previous)) await config.update(key, value, vscode.ConfigurationTarget.Global);
    await rm(home, { recursive: true, force: true });
  }
}
