import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { QuotaApi } from '../src/extension';
import type * as VSCode from 'vscode';
import { cleanup, fixtureCli, readTrace, scenarioHome } from './helpers';

type Listener = (event: { affectsConfiguration(key: string): boolean }) => void;
interface Bar {
  text: string; tooltip: string; disposed: boolean; alignment: number;
  dispose(): void; show(): void;
}
interface MockState {
  settings: Record<string, unknown>;
  kinds: Record<string, readonly string[]>;
  listeners: Set<Listener>;
  commands: Map<string, () => unknown>;
  bars: Bar[];
  messages: string[];
  errors: string[];
  output: { lines: string[]; shown: number; disposed: boolean };
  errorAction?: string;
  choice?: { target: 'local' | 'remote'; label: string };
  reloads: number;
}
let state: MockState;
const env: { remoteName?: string } = {};
const workspace = {
  isTrusted: true,
  getConfiguration(section: string) {
    return {
      get(key: string, fallback?: unknown) { return section === 'remote' ? state.kinds : state.settings[key] ?? fallback; },
      inspect() { return { globalValue: state.kinds }; },
      async update(key: string, value: unknown) {
        if (section === 'remote') state.kinds = value as MockState['kinds']; else state.settings[key] = value;
        fire(`${section}.${key}`);
      }
    };
  },
  onDidChangeConfiguration(listener: Listener) {
    state.listeners.add(listener);
    return { dispose() { state.listeners.delete(listener); } };
  }
};
const mock = {
  env, workspace, ExtensionKind: { UI: 1, Workspace: 2 }, StatusBarAlignment: { Left: 1, Right: 2 }, ConfigurationTarget: { Global: 1 },
  window: {
    createOutputChannel() {
      const output = state.output;
      return {
        appendLine(line: string) { output.lines.push(line); },
        show() { output.shown++; },
        dispose() { output.disposed = true; }
      };
    },
    createStatusBarItem(_id: string, alignment: number) {
      const bar: Bar = { text: '', tooltip: '', alignment, disposed: false, show() {}, dispose() { this.disposed = true; } };
      state.bars.push(bar);
      return bar;
    },
    async showQuickPick() { const result = state.choice; state.choice = undefined; return result; },
    async showInformationMessage(message: string) { state.messages.push(message); return undefined; },
    async showWarningMessage(message: string) { state.messages.push(message); return undefined; },
    async showErrorMessage(message: string) {
      state.messages.push(message); state.errors.push(message);
      const action = state.errorAction; state.errorAction = undefined; return action;
    }
  },
  commands: {
    registerCommand(name: string, action: () => unknown) { state.commands.set(name, action); return { dispose() { state.commands.delete(name); } }; },
    async executeCommand(name: string) {
      if (name === 'workbench.action.reloadWindow') state.reloads++;
      return state.commands.get(name)?.();
    }
  }
};

const moduleLoader = Module as unknown as { _load(request: string, parent: unknown, isMain: boolean): unknown };
const originalLoad = moduleLoader._load;
moduleLoader._load = function(request, parent, isMain) {
  return request === 'vscode' ? mock : originalLoad.call(this, request, parent, isMain);
};
const extensionModule = process.env.CODEX_QUOTA_TEST_BUNDLE ? '../../dist/extension.js' : '../src/extension';
const { activate } = require(extensionModule) as typeof import('../src/extension');
moduleLoader._load = originalLoad;

function fire(changed: string): void {
  for (const listener of state.listeners) listener({ affectsConfiguration: key => key === changed });
}

async function harness(scenario: unknown, options: { remoteName?: string; workspaceHost?: boolean; remoteSelected?: boolean; trusted?: boolean } = {}): Promise<{ api: QuotaApi; home: string; dispose(): Promise<void> }> {
  const home = await scenarioHome(scenario);
  state = {
    settings: { cliPath: fixtureCli, codexHome: home, statusBarPosition: 'right', requestTimeoutSeconds: 5 },
    kinds: options.remoteSelected ? { 'jyongli.codex-quota-vscode': ['workspace'] } : {},
    listeners: new Set(), commands: new Map(), bars: [], messages: [], errors: [],
    output: { lines: [], shown: 0, disposed: false }, reloads: 0
  };
  env.remoteName = options.remoteName;
  workspace.isTrusted = options.trusted ?? true;
  const subscriptions: VSCode.Disposable[] = [];
  const api = activate({
    extension: { id: 'jyongli.codex-quota-vscode', extensionKind: options.workspaceHost ? 2 : 1 },
    globalStorageUri: { fsPath: path.join(home, 'runtime') }, subscriptions
  } as unknown as VSCode.ExtensionContext);
  return { api, home, async dispose() { for (const subscription of subscriptions) subscription.dispose(); await cleanup(home); } };
}

test('扩展激活、命令注册、状态栏、账号来源与即时左右切换', async () => {
  const h = await harness({});
  try {
    await h.api.refresh();
    assert.equal(state.commands.size, 6);
    assert.equal(h.api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    assert.match(h.api.getState().tooltip, /fixture@example.test/);
    assert.match(h.api.getState().tooltip, /不是 VS Code 的 GitHub 账号/);
    assert.match(h.api.getState().tooltip, /5 小时额度重置/);
    assert.ok(h.api.getState().tooltip.includes(h.home));
    await mock.commands.executeCommand('codexQuota.togglePosition');
    assert.equal(h.api.getState().alignment, 'left');
    assert.ok(state.bars[0].disposed);
    assert.equal(state.bars[1].alignment, mock.StatusBarAlignment.Left);
    assert.match(h.api.getState().text, /周 60%/);
    await mock.commands.executeCommand('codexQuota.togglePosition');
    assert.equal(h.api.getState().alignment, 'right');
  } finally { await h.dispose(); }
  assert.equal(state.commands.size, 0);
  assert.ok(state.bars.every(bar => bar.disposed));
  assert.ok(state.output.disposed);
});

test('周额度、未登录和 API Key 状态在扩展中正确呈现', async () => {
  for (const [scenario, text] of [
    [{ quota: { rateLimits: { secondary: { usedPercent: 10, windowDurationMins: 10080 } } } }, 'Codex [本地] 周 90%'],
    [{ account: null }, 'Codex [本地] 未登录'],
    [{ account: { type: 'apiKey' } }, 'Codex [本地] API Key · 无订阅额度']
  ] as const) {
    const h = await harness(scenario);
    try { await h.api.refresh(); assert.equal(h.api.getState().text, text); }
    finally { await h.dispose(); }
  }
});

test('刷新失败清除旧额度和账号，避免将缓存当作当前数据', async () => {
  const h = await harness({});
  try {
    await h.api.refresh();
    assert.match(h.api.getState().text, /75%/);
    await writeFile(path.join(h.home, 'scenario.json'), JSON.stringify({ error: -32000 }));
    await h.api.refresh();
    assert.match(h.api.getState().text, /查询失败/);
    assert.ok(!h.api.getState().text.includes('75%'));
    assert.equal(h.api.getState().snapshot, undefined);
    assert.ok(!h.api.getState().tooltip.includes('SENSITIVE_MOCK_TOKEN'));
  } finally { await h.dispose(); }
});

test('失败主动提示并提供诊断，自动重复错误不刷屏，手动重试再次提示', async () => {
  const h = await harness({ exitMethod: 'account/rateLimits/read', stderr: 'database is locked SENSITIVE_MOCK_TOKEN' });
  try {
    state.errorAction = '查看诊断';
    await h.api.refresh();
    assert.equal(state.errors.length, 1);
    assert.match(state.errors[0], /退出码 4/);
    assert.equal(state.output.shown, 1);
    const log = state.output.lines.join('\n');
    assert.match(log, /读取额度/);
    const diagnostic = JSON.parse(state.output.lines[1]);
    assert.equal(diagnostic.codexHome, h.home);
    assert.equal(diagnostic.exitCode, 4);
    assert.ok(!log.includes('SENSITIVE_MOCK_TOKEN'));
    await h.api.refresh();
    assert.equal(state.errors.length, 1);
    await mock.commands.executeCommand('codexQuota.refresh');
    assert.equal(state.errors.length, 2);
    await mock.commands.executeCommand('codexQuota.showDiagnostics');
    assert.equal(state.output.shown, 2);
  } finally { await h.dispose(); }
});

test('并发刷新合并为一个 CLI 查询', async () => {
  const h = await harness({ delay: 100 });
  try {
    await Promise.all([h.api.refresh(), h.api.refresh(), h.api.refresh()]);
    assert.equal((await readTrace(h.home)).filter(row => row.method === 'account/rateLimits/read').length, 1);
  } finally { await h.dispose(); }
});

test('远程窗口中本地 UI 宿主保持本地账号；切换远程后停止本地查询并等待重载', async () => {
  const h = await harness({}, { remoteName: 'ssh-remote' });
  try {
    await h.api.refresh();
    assert.equal(h.api.getState().target, 'local');
    state.kinds = { 'other.extension': ['ui'] };
    state.choice = { target: 'remote', label: '远程' };
    await mock.commands.executeCommand('codexQuota.selectEnvironment');
    assert.deepEqual(state.kinds, { 'other.extension': ['ui'], 'jyongli.codex-quota-vscode': ['workspace'] });
    assert.match(h.api.getState().text, /待重载/);
    assert.equal(h.api.getState().snapshot, undefined);
    assert.ok(state.messages.some(message => message.includes('重载')));
    await h.api.refresh();
    assert.equal((await readTrace(h.home)).filter(row => row.method === 'account/rateLimits/read').length, 1);
  } finally { await h.dispose(); }
});

test('远程 workspace 宿主读取所在宿主的 CLI，并展示远程来源', async () => {
  const h = await harness({}, { remoteName: 'ssh-remote', workspaceHost: true, remoteSelected: true });
  try {
    await h.api.refresh();
    assert.equal(h.api.getState().target, 'remote');
    assert.match(h.api.getState().text, /Codex \[远程\].*75%/);
    assert.match(h.api.getState().tooltip, /远程 \/ ssh-remote/);
  } finally { await h.dispose(); }
});

test('未连接远程时不写远程选择；已选择远程时不悄悄查询本地', async () => {
  const h = await harness({});
  try {
    await h.api.refresh();
    state.choice = { target: 'remote', label: '远程' };
    await mock.commands.executeCommand('codexQuota.selectEnvironment');
    assert.deepEqual(state.kinds, {});
    assert.match(state.messages[0], /先连接/);
    state.kinds = { 'jyongli.codex-quota-vscode': ['workspace'] };
    fire('remote.extensionKind');
    await h.api.refresh();
    assert.match(h.api.getState().text, /未连接远程/);
    assert.equal(h.api.getState().snapshot, undefined);
  } finally { await h.dispose(); }
});

test('CLI 配置变化取消旧请求，新账号来源不会被旧响应覆盖', async () => {
  const h = await harness({ delay: 800 });
  const otherHome = await scenarioHome({ account: { type: 'chatgpt', email: 'new@example.test', planType: 'pro' } });
  try {
    const first = h.api.refresh();
    state.settings.codexHome = otherHome;
    fire('codexQuota.codexHome');
    await h.api.refresh();
    await first;
    assert.match(h.api.getState().tooltip, /new@example.test/);
    assert.ok(h.api.getState().tooltip.includes(otherHome));
    assert.ok(!h.api.getState().tooltip.includes('fixture@example.test'));
  } finally { await h.dispose(); await cleanup(otherHome); }
});

test('不信任工作区时不执行 CLI', async () => {
  const h = await harness({}, { trusted: false });
  try {
    await h.api.refresh();
    assert.match(h.api.getState().text, /信任工作区/);
    await assert.rejects(readTrace(h.home), { code: 'ENOENT' });
  } finally { await h.dispose(); }
});
