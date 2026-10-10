import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { QuotaApi } from '../src/extension';
import type * as VSCode from 'vscode';
import { cleanup, fixtureCli, readTrace, scenarioHome } from './helpers';
import { hostIpAddress } from '../src/environment';

type Listener = (event: { affectsConfiguration(key: string): boolean }) => void;
interface Bar {
  text: string; tooltip: string; disposed: boolean; alignment: number;
  dispose(): void; show(): void;
}
interface MockState {
  settings: Record<string, unknown>;
  workspaceValues: Record<string, unknown>;
  updates: { key: string; target: number }[];
  kinds: Record<string, readonly string[]>;
  listeners: Set<Listener>;
  commands: Map<string, (...args: unknown[]) => unknown>;
  bars: Bar[];
  messages: string[];
  errors: string[];
  output: { lines: string[]; shown: number; disposed: boolean };
  errorAction?: string;
  choice?: { target?: 'local' | 'remote'; command?: string; label: string };
  reloads: number;
}
let state: MockState;
const env: { remoteName?: string } = {};
const workspace = {
  isTrusted: true,
  getConfiguration(section: string) {
    return {
      get(key: string, fallback?: unknown) { return section === 'remote' ? state.kinds : state.workspaceValues[key] ?? state.settings[key] ?? fallback; },
      inspect(key: string) { return section === 'remote' ? { globalValue: state.kinds } : {
        globalValue: state.settings[key], workspaceValue: state.workspaceValues[key], workspaceFolderValue: state.workspaceValues[key]
      }; },
      async update(key: string, value: unknown, target: number) {
        state.updates.push({ key, target });
        if (section === 'remote') state.kinds = value as MockState['kinds'];
        else if (target === 2) state.workspaceValues[key] = value;
        else state.settings[key] = value;
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
  env, workspace, ExtensionKind: { UI: 1, Workspace: 2 }, StatusBarAlignment: { Left: 1, Right: 2 }, ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
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
    registerCommand(name: string, action: (...args: unknown[]) => unknown) { state.commands.set(name, action); return { dispose() { state.commands.delete(name); } }; },
    async executeCommand(name: string, ...args: unknown[]) {
      if (name === 'workbench.action.reloadWindow') state.reloads++;
      return state.commands.get(name)?.(...args);
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
const remoteMock = {
  env, ExtensionKind: mock.ExtensionKind,
  workspace: {
    get isTrusted() { return workspace.isTrusted; },
    // VS Code supplies the same merged configuration to both extension hosts.
    getConfiguration() { return workspace.getConfiguration('codexQuota'); }
  },
  commands: {
    registerCommand(name: string, action: (...args: unknown[]) => unknown) {
      state.commands.set(name, async (...args) => {
        const result = await action(...args);
        return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
      });
      return { dispose() { state.commands.delete(name); } };
    }
  }
};
moduleLoader._load = function(request, parent, isMain) {
  return request === 'vscode' ? remoteMock : originalLoad.call(this, request, parent, isMain);
};
const remoteModule = process.env.CODEX_QUOTA_TEST_BUNDLE ? '../../remote-provider/dist/remote.js' : '../src/remote';
const { activate: activateRemote } = require(remoteModule) as typeof import('../src/remote');
moduleLoader._load = originalLoad;

function fire(changed: string): void {
  for (const listener of state.listeners) listener({ affectsConfiguration: key => key === changed });
}

async function harness(scenario: unknown, options: {
  remoteName?: string; workspaceHost?: boolean; remoteSelected?: boolean; trusted?: boolean;
  provider?: boolean; providerUi?: boolean; remoteScenario?: unknown; workspacePosition?: string; legacyKinds?: boolean;
} = {}): Promise<{ api: QuotaApi; home: string; remoteHome?: string; dispose(): Promise<void> }> {
  const home = await scenarioHome(scenario);
  state = {
    settings: { cliPath: fixtureCli, codexHome: home, statusBarPosition: 'right', requestTimeoutSeconds: 5,
      ...(options.remoteSelected ? { executionEnvironment: 'remote' } : {}) },
    workspaceValues: options.workspacePosition ? { statusBarPosition: options.workspacePosition } : {}, updates: [],
    kinds: options.legacyKinds ? { 'other.extension': ['ui'], 'jyongli.codex-quota-vscode': ['workspace'] } : {},
    listeners: new Set(), commands: new Map(), bars: [], messages: [], errors: [],
    output: { lines: [], shown: 0, disposed: false }, reloads: 0
  };
  env.remoteName = options.remoteName;
  workspace.isTrusted = options.trusted ?? true;
  const subscriptions: VSCode.Disposable[] = [];
  const remoteSubscriptions: VSCode.Disposable[] = [];
  const remoteHome = options.provider ? await scenarioHome(options.remoteScenario ?? { account: { type: 'chatgpt', email: 'remote@example.test', planType: 'pro' } }) : undefined;
  if (remoteHome) {
    state.settings.remoteCliPath = fixtureCli;
    state.settings.remoteCodexHome = remoteHome;
    activateRemote({ extension: { extensionKind: options.providerUi ? 1 : 2 }, subscriptions: remoteSubscriptions } as unknown as VSCode.ExtensionContext);
  }
  const api = await activate({
    extension: { id: 'jyongli.codex-quota-vscode', extensionKind: options.workspaceHost ? 2 : 1 },
    globalStorageUri: { fsPath: path.join(home, 'runtime') }, subscriptions
  } as unknown as VSCode.ExtensionContext);
  return { api, home, remoteHome, async dispose() {
    for (const subscription of [...subscriptions, ...remoteSubscriptions]) subscription.dispose();
    await cleanup(home); if (remoteHome) await cleanup(remoteHome);
  } };
}

test('扩展激活、命令注册、状态栏、账号来源与即时左右切换', async () => {
  const h = await harness({});
  try {
    await h.api.refresh();
    assert.equal(state.commands.size, 6);
    assert.equal(h.api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    assert.match(h.api.getState().tooltip, /fixture@example.test/);
    assert.ok(h.api.getState().tooltip.includes(`IP 地址：${hostIpAddress()}`));
    assert.match(h.api.getState().tooltip, /5 小时额度重置/);
    assert.match(h.api.getState().tooltip, /刷新时间间隔：5 分钟（300 秒）/);
    assert.doesNotMatch(h.api.getState().tooltip, /数据来源：|账号来源：|CLI：|Codex 配置目录：|凭据由 Codex/);
    await mock.commands.executeCommand('codexQuota.showAccount');
    assert.match(state.messages[0], /不是 VS Code 的 GitHub 账号/);
    assert.ok(state.messages[0].includes(h.home));
    state.settings.refreshIntervalSeconds = 90;
    fire('codexQuota.refreshIntervalSeconds');
    await h.api.refresh();
    assert.match(h.api.getState().tooltip, /刷新时间间隔：90 秒/);
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

test('本地／远程即时切换读取各自账号，不重载、不改扩展宿主设置', async () => {
  const h = await harness({}, { remoteName: 'ssh-remote', provider: true });
  try {
    await h.api.refresh();
    assert.equal(h.api.getState().target, 'local');
    state.kinds = { 'other.extension': ['ui'] };
    state.choice = { target: 'remote', label: '远程' };
    await mock.commands.executeCommand('codexQuota.selectEnvironment');
    assert.deepEqual(state.kinds, { 'other.extension': ['ui'] });
    assert.equal(h.api.getState().target, 'remote');
    assert.match(h.api.getState().tooltip, /remote@example.test/);
    assert.equal(h.api.getState().snapshot?.codexHome, h.remoteHome);
    assert.equal((await readTrace(h.home)).filter(row => row.method === 'account/rateLimits/read').length, 1);
    state.choice = { target: 'local', label: '本地' };
    await mock.commands.executeCommand('codexQuota.selectEnvironment');
    assert.equal(h.api.getState().target, 'local');
    assert.match(h.api.getState().tooltip, /fixture@example.test/);
    assert.equal(state.reloads, 0);
    assert.ok(!state.messages.some(message => message.includes('重载')));
  } finally { await h.dispose(); }
});

test('远程查询组件使用其自身的 CLI 配置，不读取本机账号', async () => {
  const h = await harness({}, { remoteName: 'ssh-remote', provider: true, remoteSelected: true });
  try {
    await h.api.refresh();
    assert.equal(h.api.getState().target, 'remote');
    assert.match(h.api.getState().text, /Codex \[远程\].*75%/);
    assert.ok(h.api.getState().tooltip.includes(`IP 地址：${hostIpAddress()}`));
    assert.doesNotMatch(h.api.getState().tooltip, /实际执行环境：/);
    assert.match(h.api.getState().tooltip, /remote@example.test/);
    await assert.rejects(readTrace(h.home), { code: 'ENOENT' });
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
    state.settings.executionEnvironment = 'remote';
    fire('codexQuota.executionEnvironment');
    await h.api.refresh();
    assert.match(h.api.getState().text, /未连接远程/);
    assert.equal(h.api.getState().snapshot, undefined);
  } finally { await h.dispose(); }
});

test('工作区覆盖位置设置时，切换更新生效层并立即改变状态栏', async () => {
  const h = await harness({}, { workspacePosition: 'right' });
  try {
    await h.api.refresh();
    state.settings.statusBarPosition = 'left';
    state.choice = { label: '切换状态栏左右位置', command: 'codexQuota.togglePosition' };
    await mock.commands.executeCommand('codexQuota.menu');
    assert.equal(h.api.getState().alignment, 'left');
    assert.equal(state.workspaceValues.statusBarPosition, 'left');
    assert.equal(state.updates.at(-1)?.target, mock.ConfigurationTarget.Workspace);
    await mock.commands.executeCommand('codexQuota.togglePosition');
    assert.equal(h.api.getState().alignment, 'right');
    assert.equal(state.settings.statusBarPosition, 'left');
  } finally { await h.dispose(); }
});

test('远程组件缺失时清除本地额度，不将本机结果伪装为远程', async () => {
  const h = await harness({}, { remoteName: 'ssh-remote' });
  try {
    await h.api.refresh();
    state.choice = { target: 'remote', label: '远程' };
    await mock.commands.executeCommand('codexQuota.selectEnvironment');
    assert.equal(h.api.getState().snapshot, undefined);
    assert.match(h.api.getState().tooltip, /远程查询组件/);
    assert.match(h.api.getState().tooltip, /IP 地址：未获取到/);
    assert.equal(state.reloads, 0);
  } finally { await h.dispose(); }
});

test('远程窗口中错误装在 UI 宿主的查询组件不读取本机账号', async () => {
  const h = await harness({}, { remoteName: 'ssh-remote', provider: true, providerUi: true, remoteSelected: true });
  try {
    await h.api.refresh();
    assert.equal(h.api.getState().snapshot, undefined);
    assert.match(h.api.getState().tooltip, /工作区宿主/);
    await assert.rejects(readTrace(h.remoteHome!), { code: 'ENOENT' });
    await assert.rejects(readTrace(h.home), { code: 'ENOENT' });
  } finally { await h.dispose(); }
});

test('远程查询期间切回本地取消远程进程，晚到结果不会覆盖本地账号', async () => {
  const h = await harness({}, { remoteName: 'ssh-remote', provider: true, remoteScenario: { delay: 1000, account: { type: 'chatgpt', email: 'remote@example.test', planType: 'pro' } } });
  try {
    await h.api.refresh();
    state.choice = { target: 'remote', label: '远程' };
    const remoteQuery = mock.commands.executeCommand('codexQuota.selectEnvironment');
    let pid: number | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const trace = await readTrace(h.remoteHome!);
        if (trace.some(row => row.method === 'account/rateLimits/read')) { pid = trace[0].pid as number; break; }
      } catch { /* Wait for the independent remote protocol peer to start. */ }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(pid, 'remote quota request must be active');
    state.choice = { target: 'local', label: '本地' };
    await mock.commands.executeCommand('codexQuota.selectEnvironment');
    await remoteQuery;
    assert.equal(h.api.getState().target, 'local');
    assert.match(h.api.getState().tooltip, /fixture@example.test/);
    assert.doesNotMatch(h.api.getState().tooltip, /remote@example.test/);
    assert.equal(state.reloads, 0);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally { await h.dispose(); }
});

test('升级迁移旧宿主设置，仅移除本插件的旧覆盖并保留其他插件', async () => {
  const h = await harness({}, { remoteName: 'ssh-remote', provider: true, legacyKinds: true });
  try {
    await h.api.refresh();
    assert.deepEqual(state.kinds, { 'other.extension': ['ui'] });
    assert.equal(state.settings.executionEnvironment, 'remote');
    assert.match(h.api.getState().tooltip, /remote@example.test/);
    assert.equal(state.reloads, 0);
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
    assert.equal(h.api.getState().snapshot?.codexHome, otherHome);
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
