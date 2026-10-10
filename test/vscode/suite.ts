import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { QuotaApi } from '../../src/extension';

export async function run(): Promise<void> {
  const home = await mkdtemp(path.join(tmpdir(), 'codex-quota-vscode-'));
  const config = vscode.workspace.getConfiguration('codexQuota');
  const previous = Object.fromEntries(['cliPath', 'codexHome', 'statusBarPosition'].map(key => [key, config.inspect(key)?.globalValue]));
  try {
    await writeFile(path.join(home, 'scenario.json'), '{}');
    await config.update('cliPath', path.resolve(__dirname, '../../../test/fixtures/codex.cjs'), vscode.ConfigurationTarget.Global);
    await config.update('codexHome', home, vscode.ConfigurationTarget.Global);
    await config.update('statusBarPosition', 'right', vscode.ConfigurationTarget.Global);
    const extension = vscode.extensions.getExtension<QuotaApi>('jyongli.codex-quota-vscode');
    assert.ok(extension, 'extension must be discovered');
    const api = await extension.activate();
    await api.refresh();
    assert.equal(api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    assert.match(api.getState().tooltip, /fixture@example.test/);
    console.log('PASS: extension activation, real child-process quota, account source');
    await vscode.commands.executeCommand('codexQuota.togglePosition');
    assert.equal(api.getState().alignment, 'left');
    console.log('PASS: status bar position change');
    await writeFile(path.join(home, 'scenario.json'), JSON.stringify({ quota: { rateLimits: { secondary: { usedPercent: 10, windowDurationMins: 10080 } } } }));
    await vscode.commands.executeCommand('codexQuota.refresh');
    assert.equal(api.getState().text, 'Codex [本地] 周 90%');
    console.log('PASS: weekly-only status');
    await writeFile(path.join(home, 'scenario.json'), JSON.stringify({ account: { type: 'apiKey' } }));
    await vscode.commands.executeCommand('codexQuota.refresh');
    assert.match(api.getState().text, /API Key/);
    console.log('PASS: API-key account has no fabricated subscription quota');
  } finally {
    for (const [key, value] of Object.entries(previous)) await config.update(key, value, vscode.ConfigurationTarget.Global);
    await rm(home, { recursive: true, force: true });
  }
}
