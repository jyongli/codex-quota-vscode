import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { QuotaApi } from '../../src/extension';
import { ReadableStream } from 'node:stream/web';
import { npmFixture } from '../install-helpers';

async function openSettingsFromMenu(): Promise<void> {
  const command = vscode.commands.executeCommand('codexQuota.menu');
  await new Promise(resolve => setTimeout(resolve, 250));
  for (let step = 0; step < 3; step++) await vscode.commands.executeCommand('workbench.action.quickOpenSelectNext');
  await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
  await Promise.race([
    command,
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Menu command did not complete')), 10000); timer.unref(); })
  ]);
}

export async function run(): Promise<void> {
  const home = await mkdtemp(path.join(tmpdir(), 'codex-quota-vscode-'));
  const config = vscode.workspace.getConfiguration('codexQuota');
  const previous = Object.fromEntries(['cliPath', 'codexHome', 'remoteCliPath', 'remoteCodexHome', 'environments', 'autoInstallCli', 'statusBarPosition', 'language', 'showPublicIp'].map(key => [key, config.inspect(key)?.globalValue]));
  try {
    await config.update('language', 'zh-CN', vscode.ConfigurationTarget.Global);
    await config.update('showPublicIp', false, vscode.ConfigurationTarget.Global);
    await writeFile(path.join(home, 'scenario.json'), '{}');
    await config.update('cliPath', path.resolve(__dirname, '../../../test/fixtures/codex.cjs'), vscode.ConfigurationTarget.Global);
    await config.update('codexHome', home, vscode.ConfigurationTarget.Global);
    await config.update('statusBarPosition', 'right', vscode.ConfigurationTarget.Global);
    await config.update('statusBarPosition', 'right', vscode.ConfigurationTarget.Workspace);
    const extension = vscode.extensions.getExtension<QuotaApi>('ujyong.codex-quota-monitor-ujyong');
    assert.ok(extension, 'extension must be discovered');
    assert.equal(extension.packageJSON.publisher, 'ujyong');
    assert.equal(extension.packageJSON.name, 'codex-quota-monitor-ujyong');
    // The API reports UI for a local process even when the manifest prefers
    // the workspace host; Workspace means it is executing remotely.
    assert.equal(extension.extensionKind, vscode.ExtensionKind.UI);
    assert.deepEqual(extension.packageJSON.extensionKind, ['workspace']);
    assert.equal(extension.packageJSON.contributes.configuration.properties['codexQuota.cliPath'].scope, 'machine');
    const api = await extension.activate();
    assert.equal(api.getState().target, 'local');
    const commands = await vscode.commands.getCommands(true);
    for (const name of ['selectEnvironment', 'togglePosition', 'selectLanguage']) assert.ok(!commands.includes(`codexQuota.${name}`));
    assert.equal(vscode.extensions.getExtension('jyongli.codex-quota-remote'), undefined);
    console.log('PASS: one workspace extension uses its installed host; no host override or companion');
    await api.refresh();
    assert.equal(api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    assert.match(api.getState().tooltip, /fixture@example.test/);
    assert.match(api.getState().tooltip, /IP 地址：.+/);
    assert.match(api.getState().tooltip, /刷新时间间隔：5 分钟（300 秒）/);
    assert.doesNotMatch(api.getState().tooltip, /数据来源：|账号来源：|CLI：|Codex 配置目录：|凭据由 Codex/);
    console.log('PASS: extension activation, real child-process quota, compact tooltip with host IP and refresh interval');
    const checkedAt = api.getState().snapshot?.checkedAt;
    await config.update('language', 'en', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(api.getState().text, 'Codex [Local] 5h 75% · Week 60%');
    assert.match(api.getState().tooltip, /Account: fixture@example.test/);
    assert.equal(api.getState().snapshot?.checkedAt, checkedAt);
    await config.update('language', 'zh-CN', vscode.ConfigurationTarget.Workspace);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.match(api.getState().text, /Codex \[本地\]/);
    assert.equal(api.getState().snapshot?.checkedAt, checkedAt);
    await config.update('language', 'en', vscode.ConfigurationTarget.Workspace);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.match(api.getState().text, /Codex \[Local\]/);
    await config.update('language', 'zh-CN', vscode.ConfigurationTarget.Global);
    await config.update('language', undefined, vscode.ConfigurationTarget.Workspace);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.match(api.getState().text, /Codex \[本地\]/);
    assert.equal(api.getState().snapshot?.checkedAt, checkedAt);
    console.log('PASS: native language settings apply immediately, respect workspace overrides and preserve quota');
    await openSettingsFromMenu();
    assert.equal(api.getState().snapshot?.checkedAt, checkedAt);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    console.log('PASS: the simplified menu opens extension settings from its fourth item');
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
    const positionSnapshot = api.getState().snapshot;
    await config.update('statusBarPosition', 'left', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(api.getState().alignment, 'right', 'workspace setting must take priority');
    await config.update('statusBarPosition', 'left', vscode.ConfigurationTarget.Workspace);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(api.getState().alignment, 'left');
    await config.update('statusBarPosition', 'right', vscode.ConfigurationTarget.Workspace);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(api.getState().alignment, 'right');
    assert.equal(api.getState().snapshot, positionSnapshot);
    console.log('PASS: native status bar position settings apply immediately and preserve quota');
    await config.update('environments', [{ name: 'Same account', codexHome: home + path.sep }], vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 100));
    await api.refresh();
    assert.equal(api.getState().sources.length, 1);
    assert.equal(api.getState().selectedSource, 'cli');
    assert.equal(api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    console.log('PASS: identical actual configuration directory and account merge automatically');
    const secondHome = path.join(home, 'second-account');
    await mkdir(secondHome);
    await writeFile(path.join(secondHome, 'scenario.json'), JSON.stringify({ account: { type: 'chatgpt', email: 'second-account@example.test', planType: 'pro' } }));
    await config.update('environments', [{ name: 'Second account', codexHome: secondHome }], vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 100));
    await api.refresh();
    assert.equal(api.getState().sources.length, 2);
    assert.equal(api.getState().snapshot, undefined);
    assert.match(api.getState().text, /选择查询来源/);
    // The first distinct-source picker opens automatically, without invoking
    // the command or clicking the status bar.
    await new Promise(resolve => setTimeout(resolve, 250));
    await vscode.commands.executeCommand('workbench.action.quickOpenSelectNext');
    await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
    const deadline = Date.now() + 10000;
    while (api.getState().selectedSource !== 'environment:Second account' && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await api.refresh();
    assert.equal(api.getState().selectedSource, 'environment:Second account');
    assert.equal(api.getState().snapshot?.codexHome, secondHome);
    assert.match(api.getState().tooltip, /second-account@example.test/);
    await config.update('environments', [], vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 100));
    await api.refresh();
    assert.equal(api.getState().sources.length, 1);
    assert.equal(api.getState().selectedSource, 'cli');
    assert.equal(api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    console.log('PASS: distinct sources open an actual picker automatically; singleton restores its account without reloading');
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
      if (process.platform === 'win32') {
        const launcher = path.join(home, 'codex.cmd');
        const marker = path.join(home, 'shell-ran.txt');
        await writeFile(launcher, '@echo SCRIPT_MUST_NOT_RUN > "%~dp0shell-ran.txt"\r\n'
          + `@"${process.env.CODEX_QUOTA_NATIVE_CLI}" %*\r\n`);
        await config.update('cliPath', launcher, vscode.ConfigurationTarget.Global);
        await config.update('environments', [{ name: 'Same native account', cliPath: process.env.CODEX_QUOTA_NATIVE_CLI, codexHome: nativeHome }], vscode.ConfigurationTarget.Global);
        await api.refresh();
        assert.equal(api.getState().sources.length, 1);
        assert.match(api.getState().text, /未登录/);
        assert.match(api.getState().snapshot?.cliPath ?? '', /codex\.exe$/i);
        assert.equal(api.getState().snapshot?.codexHome, nativeHome);
        await assert.rejects(readFile(marker));
        await config.update('environments', [], vscode.ConfigurationTarget.Global);
        console.log('PASS: Windows host resolves a nonadjacent official CMD entry directly to native CLI; same configuration accounts merge without running shell content');
      }
    }
    const previousPath = process.env.PATH;
    const previousFixture = process.env.CODEX_QUOTA_NPM_FIXTURE;
    try {
      const installEnv = await npmFixture(home, { delay: 300 });
      process.env.PATH = installEnv.PATH;
      process.env.CODEX_QUOTA_NPM_FIXTURE = installEnv.CODEX_QUOTA_NPM_FIXTURE;
      await writeFile(path.join(home, 'scenario.json'), JSON.stringify({ account: null }));
      await config.update('codexHome', home, vscode.ConfigurationTarget.Global);
      await config.update('autoInstallCli', true, vscode.ConfigurationTarget.Global);
      await config.update('cliPath', 'codex', vscode.ConfigurationTarget.Global);
      await api.refresh();
      assert.match(api.getState().text, /未登录/);
      assert.match(api.getState().tooltip, /npx @openai\/codex login/);
      const entry = api.getState().snapshot?.cliPath;
      assert.ok(entry?.includes('codex-cli'));
      assert.equal(api.getState().snapshot?.codexHome, home);
      await api.refresh();
      assert.equal(api.getState().snapshot?.cliPath, entry);
      assert.equal((await readFile(path.join(home, 'npm-trace.jsonl'), 'utf8')).trim().split('\n').length, 1);
      console.log('PASS: actual VS Code host automatically installs a missing CLI in background and reuses it, preserving account home');
    } finally {
      if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
      if (previousFixture === undefined) delete process.env.CODEX_QUOTA_NPM_FIXTURE; else process.env.CODEX_QUOTA_NPM_FIXTURE = previousFixture;
      await config.update('cliPath', path.resolve(__dirname, '../../../test/fixtures/codex.cjs'), vscode.ConfigurationTarget.Global);
      await api.refresh();
    }
  } finally {
    await config.update('language', undefined, vscode.ConfigurationTarget.Workspace);
    await config.update('statusBarPosition', undefined, vscode.ConfigurationTarget.Workspace);
    for (const [key, value] of Object.entries(previous)) await config.update(key, value, vscode.ConfigurationTarget.Global);
    await rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
