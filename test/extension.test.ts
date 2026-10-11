import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { QuotaApi } from '../src/extension';
import type * as VSCode from 'vscode';
import { cleanup, fixtureCli, readTrace, scenarioHome } from './helpers';
import { hostIpAddress } from '../src/environment';
import type { LanguageSetting } from '../src/i18n';
import { npmFixture } from './install-helpers';

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
  choice?: { command?: string; label: string; id?: string };
  picks: { label: string }[][];
  reloads: number;
  installs: unknown[];
  openedSettings?: unknown;
  install?: () => Promise<void>;
  storageError?: Error;
  globalPreferences: Record<string, unknown>;
  workspacePreferences: Record<string, unknown>;
}
let state: MockState;
const env: { remoteName?: string; language: string } = { language: 'zh-cn' };
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
let ide: { extensionKind: number; extensionUri: { fsPath: string } } | undefined;
const mock = {
  extensions: { getExtension() { return ide; }, onDidChange() { return { dispose() {} }; } },
  Uri: { joinPath(base: { fsPath: string }, ...parts: string[]) { return { fsPath: path.join(base.fsPath, ...parts) }; } },
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
    async showQuickPick(items: { label: string }[]) { state.picks.push(items); const result = state.choice; state.choice = undefined; return result; },
    async showInformationMessage(message: string) { state.messages.push(message); return undefined; },
    async showWarningMessage(message: string) { state.messages.push(message); const action = state.errorAction; state.errorAction = undefined; return action; },
    async showErrorMessage(message: string) {
      state.messages.push(message); state.errors.push(message);
      const action = state.errorAction; state.errorAction = undefined; return action;
    }
  },
  commands: {
    async getCommands() { return [...state.commands.keys()]; },
    registerCommand(name: string, action: (...args: unknown[]) => unknown) { state.commands.set(name, action); return { dispose() { state.commands.delete(name); } }; },
    async executeCommand(name: string, ...args: unknown[]) {
      if (name === 'workbench.extensions.installExtension') {
        state.installs.push(args[0]);
        if (!state.install) throw new Error('Mock install failure SENSITIVE_MOCK_TOKEN');
        return state.install();
      }
      if (name === 'workbench.action.reloadWindow') state.reloads++;
      if (name === 'workbench.action.openSettings') state.openedSettings = args[0];
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
moduleLoader._load = originalLoad;

function fire(changed: string): void {
  for (const listener of state.listeners) listener({ affectsConfiguration: key => key === changed });
}

async function harness(scenario: unknown, options: {
  remoteName?: string; workspaceHost?: boolean; trusted?: boolean; legacyRemote?: boolean; workspacePosition?: string; legacyKinds?: boolean; language?: LanguageSetting; vscodeLanguage?: string; workspaceLanguage?: LanguageSetting; publicIp?: boolean;
  globalPreferences?: Record<string, unknown>; workspacePreferences?: Record<string, unknown>;
  missingCli?: boolean; npmScenario?: unknown; environments?: unknown; ide?: { extensionKind: number; extensionUri: { fsPath: string } }; ideCli?: string;
} = {}): Promise<{ api: QuotaApi; home: string; dispose(): Promise<void> }> {
  const home = await scenarioHome(scenario);
  ide = options.ide;
  const previousPath = process.env.PATH;
  const previousNpmFixture = process.env.CODEX_QUOTA_NPM_FIXTURE;
  if (options.missingCli) {
    const installEnv = await npmFixture(home, options.npmScenario);
    process.env.PATH = installEnv.PATH;
    process.env.CODEX_QUOTA_NPM_FIXTURE = installEnv.CODEX_QUOTA_NPM_FIXTURE;
  }
  state = {
    settings: { environments: options.environments ?? [], cliExecutable: options.ideCli, language: options.language ?? 'auto', showPublicIp: options.publicIp ?? false, cliPath: options.missingCli ? 'codex' : fixtureCli, codexHome: home, statusBarPosition: 'right', requestTimeoutSeconds: 5,
      ...(options.legacyRemote ? { cliPath: undefined, codexHome: undefined, remoteCliPath: fixtureCli, remoteCodexHome: home } : {}) },
    workspaceValues: { ...(options.workspacePosition ? { statusBarPosition: options.workspacePosition } : {}), ...(options.workspaceLanguage ? { language: options.workspaceLanguage } : {}) }, updates: [],
    kinds: options.legacyKinds ? { 'other.extension': ['ui'], 'jyongli.codex-quota-vscode': ['workspace'] } : {},
    listeners: new Set(), commands: new Map(), bars: [], messages: [], errors: [],
    output: { lines: [], shown: 0, disposed: false }, picks: [], reloads: 0, installs: [],
    globalPreferences: options.globalPreferences ?? {}, workspacePreferences: options.workspacePreferences ?? {}
  };
  env.remoteName = options.remoteName;
  env.language = options.vscodeLanguage ?? 'zh-cn';
  workspace.isTrusted = options.trusted ?? true;
  const subscriptions: VSCode.Disposable[] = [];
  const api = await activate({
    globalState: {
      get(key: string) { return state.globalPreferences[key]; },
      async update(key: string, value: unknown) { if (state.storageError) throw state.storageError; if (value === undefined) delete state.globalPreferences[key]; else state.globalPreferences[key] = value; }
    },
    workspaceState: {
      get(key: string) { return state.workspacePreferences[key]; },
      async update(key: string, value: unknown) { if (state.storageError) throw state.storageError; if (value === undefined) delete state.workspacePreferences[key]; else state.workspacePreferences[key] = value; }
    },
    extensionUri: { fsPath: path.resolve(__dirname, '../..') },
    extension: { id: 'ujyong.codex-quota-monitor-ujyong', extensionKind: (options.workspaceHost ?? !!options.remoteName) ? 2 : 1 },
    globalStorageUri: { fsPath: path.join(home, 'runtime') }, subscriptions
  } as unknown as VSCode.ExtensionContext);
  return { api, home, async dispose() {
    for (const subscription of subscriptions) subscription.dispose();
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    if (previousNpmFixture === undefined) delete process.env.CODEX_QUOTA_NPM_FIXTURE; else process.env.CODEX_QUOTA_NPM_FIXTURE = previousNpmFixture;
    await cleanup(home);
  } };
}

test('CLI 缺失时仅在插件安装宿主后台安装，随后复用；安装不要求重载或写入设置', async () => {
  for (const remoteName of [undefined, 'ssh-remote']) {
    const h = await harness({ account: null }, { missingCli: true, remoteName, npmScenario: { delay: 300 } });
    try {
      const pending = h.api.refresh();
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.match(h.api.getState().text, /正在安装 Codex CLI/);
      state.settings.language = 'en'; fire('codexQuota.language');
      assert.match(h.api.getState().text, /Installing Codex CLI/);
      await Promise.all([pending, h.api.refresh()]);
      assert.equal(h.api.getState().target, remoteName ? 'remote' : 'local');
      assert.match(h.api.getState().text, /Signed out/);
      assert.match(h.api.getState().tooltip, /npx @openai\/codex login/);
      assert.ok(h.api.getState().snapshot?.cliPath.startsWith(await realpath(path.join(h.home, 'runtime'))));
      assert.equal(h.api.getState().snapshot?.codexHome, h.home);
      await h.api.refresh();
      assert.equal((await readFile(path.join(h.home, 'npm-trace.jsonl'), 'utf8')).trim().split('\n').length, 1);
      assert.equal(state.updates.length, 0);
      assert.equal(state.reloads, 0);
      assert.equal(state.installs.length, 0);
    } finally { await h.dispose(); }
  }
});

test('自动安装失败显示具体类别和双语提示，手动刷新可恢复，未登录不当作失败', async () => {
  const h = await harness({ account: null }, { missingCli: true, npmScenario: { fail: 1, stderr: 'ECONNRESET SENSITIVE_NPM_TOKEN' } });
  try {
    await h.api.refresh();
    assert.match(h.api.getState().tooltip, /自动安装失败.*网络/);
    assert.doesNotMatch(state.output.lines.join('\n') + state.errors.join('\n'), /SENSITIVE_NPM_TOKEN/);
    state.settings.language = 'en'; fire('codexQuota.language');
    assert.match(h.api.getState().tooltip, /installation failed.*network/);
    await writeFile(path.join(h.home, 'npm-scenario.json'), '{}');
    await mock.commands.executeCommand('codexQuota.refresh');
    assert.match(h.api.getState().text, /Signed out/);
    assert.ok(h.api.getState().snapshot);
  } finally { await h.dispose(); }
});

test('扩展激活、命令注册、状态栏、账号来源与即时左右切换', async () => {
  const h = await harness({});
  try {
    await h.api.refresh();
    assert.equal(state.commands.size, 5);
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
    await workspace.getConfiguration('codexQuota').update('statusBarPosition', h.api.getState().alignment === 'left' ? 'right' : 'left', mock.ConfigurationTarget.Global);
    assert.equal(h.api.getState().alignment, 'left');
    assert.ok(state.bars[0].disposed);
    assert.equal(state.bars[1].alignment, mock.StatusBarAlignment.Left);
    assert.match(h.api.getState().text, /周 60%/);
    await workspace.getConfiguration('codexQuota').update('statusBarPosition', h.api.getState().alignment === 'left' ? 'right' : 'left', mock.ConfigurationTarget.Global);
    assert.equal(h.api.getState().alignment, 'right');
  } finally { await h.dispose(); }
  assert.equal(state.commands.size, 0);
  assert.ok(state.bars.every(bar => bar.disposed));
  assert.ok(state.output.disposed);
});

test('一个来源直接显示；多个来源先选择，取消不查询，切换保留各自账号且无需重载', async () => {
  const other = await scenarioHome({ account: { type: 'chatgpt', email: 'other-host-profile@example.test', planType: 'pro' },
    quota: { rateLimits: { secondary: { usedPercent: 12, windowDurationMins: 10080 } } } });
  const h = await harness({}, { environments: [{ name: 'Other account', codexHome: other }] });
  try {
    await h.api.refresh();
    assert.equal(h.api.getState().sources.length, 2);
    assert.match(h.api.getState().text, /选择查询来源/);
    assert.equal(h.api.getState().snapshot, undefined);
    await assert.rejects(readTrace(h.home), { code: 'ENOENT' });
    await mock.commands.executeCommand('codexQuota.menu');
    assert.equal(state.picks.at(-1)?.length, 2);
    assert.equal(h.api.getState().snapshot, undefined);
    state.choice = { id: 'environment:Other account', label: 'Other account' };
    await mock.commands.executeCommand('codexQuota.selectSource');
    assert.match(h.api.getState().text, /CLI \/ Other account.*周 88%/);
    assert.match(h.api.getState().tooltip, /other-host-profile@example.test/);
    assert.equal(h.api.getState().snapshot?.codexHome, other);
    assert.equal(state.workspacePreferences.selectedSource, 'environment:Other account');
    assert.equal(state.updates.length, 0);
    state.choice = { id: 'cli', label: 'CLI' };
    await mock.commands.executeCommand('codexQuota.selectSource');
    assert.match(h.api.getState().tooltip, /fixture@example.test/);
    assert.doesNotMatch(h.api.getState().tooltip, /other-host-profile/);
    assert.equal(state.reloads, 0);
    assert.equal(state.installs.length, 0);
    state.settings.environments = [];
    fire('codexQuota.environments');
    await h.api.refresh();
    assert.equal(h.api.getState().text, 'Codex [本地] 5 小时 75% · 周 60%');
    const picks = state.picks.length;
    await mock.commands.executeCommand('codexQuota.selectSource');
    assert.equal(state.picks.length, picks);
  } finally { await h.dispose(); await cleanup(other); }
});

test('来源选择恢复、只读偏好不阻止切换，取消旧查询后晚到响应不覆盖新账号', async () => {
  const other = await scenarioHome({ account: { type: 'chatgpt', email: 'selected@example.test', planType: 'pro' } });
  const h = await harness({ delay: 800 }, { environments: [{ name: 'New', codexHome: other }], workspacePreferences: { selectedSource: 'cli' } });
  try {
    const old = h.api.refresh();
    await new Promise(resolve => setTimeout(resolve, 100));
    state.storageError = new Error('EACCES SENSITIVE_MOCK_TOKEN');
    state.choice = { id: 'environment:New', label: 'New' };
    await mock.commands.executeCommand('codexQuota.selectSource');
    await old;
    assert.match(h.api.getState().tooltip, /selected@example.test/);
    assert.doesNotMatch(h.api.getState().tooltip, /fixture@example.test/);
    assert.match(state.output.lines.join('\n'), /偏好无法保存/);
    assert.doesNotMatch(state.output.lines.join('\n'), /SENSITIVE_MOCK_TOKEN/);
    assert.equal(state.reloads, 0);
  } finally { await h.dispose(); await cleanup(other); }
});

test('IDE 来源使用官方插件同宿主的共享目录，不继承自定义 CLI 账号；其他宿主不冒充可用来源', async () => {
  const other = await scenarioHome({ account: { type: 'chatgpt', email: 'ide-config@example.test', planType: 'pro' } });
  const previousHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = other;
  const h = await harness({}, { ide: { extensionKind: 1, extensionUri: { fsPath: path.dirname(fixtureCli) } }, ideCli: fixtureCli });
  try {
    await h.api.refresh();
    assert.deepEqual(h.api.getState().sources.map(source => source.id), ['cli', 'ide']);
    state.choice = { id: 'ide', label: 'IDE' };
    await mock.commands.executeCommand('codexQuota.selectSource');
    assert.equal(h.api.getState().snapshot?.codexHome, other);
    assert.match(h.api.getState().tooltip, /ide-config@example.test/);
    await mock.commands.executeCommand('codexQuota.showAccount');
    assert.match(state.messages.at(-1)!, /共享的 Codex 配置目录/);
    assert.match(state.messages.at(-1)!, /不读取插件内存/);
    assert.match(state.messages.at(-1)!, /额度共享/);
    ide!.extensionKind = 2;
    await h.api.refresh();
    assert.equal(h.api.getState().sources.length, 1);
    assert.equal(h.api.getState().selectedSource, 'cli');
    assert.match(h.api.getState().tooltip, /fixture@example.test/);
  } finally {
    await h.dispose(); await cleanup(other);
    if (previousHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previousHome;
  }
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

test('原生设置遵循工作区覆盖，修改位置立即生效并保留额度', async () => {
  const h = await harness({}, { workspacePosition: 'right' });
  try {
    await h.api.refresh();
    const snapshot = h.api.getState().snapshot;
    const trace = await readTrace(h.home);
    const config = workspace.getConfiguration('codexQuota');
    await config.update('statusBarPosition', 'left', mock.ConfigurationTarget.Global);
    assert.equal(h.api.getState().alignment, 'right');
    await config.update('statusBarPosition', 'left', mock.ConfigurationTarget.Workspace);
    assert.equal(h.api.getState().alignment, 'left');
    await config.update('statusBarPosition', 'right', mock.ConfigurationTarget.Workspace);
    assert.equal(h.api.getState().alignment, 'right');
    assert.equal(h.api.getState().snapshot, snapshot);
    assert.deepEqual(await readTrace(h.home), trace);
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

test('原生语言设置立即重译已有额度和菜单，不重查 CLI；工作区覆盖优先', async () => {
  const h = await harness({}, { workspaceLanguage: 'zh-CN' });
  try {
    await h.api.refresh();
    const snapshot = h.api.getState().snapshot;
    const trace = await readTrace(h.home);
    const config = workspace.getConfiguration('codexQuota');
    await config.update('language', 'en', mock.ConfigurationTarget.Global);
    assert.match(h.api.getState().text, /Codex \[本地\]/);
    await config.update('language', 'en', mock.ConfigurationTarget.Workspace);
    assert.equal(h.api.getState().text, 'Codex [Local] 5h 75% · Week 60%');
    assert.match(h.api.getState().tooltip, /Account: fixture@example.test.*ChatGPT/);
    assert.match(h.api.getState().tooltip, /5-hour quota resets:.*\nWeekly quota resets:/);
    assert.match(h.api.getState().tooltip, /Refresh interval: 5 minutes \(300 seconds\)/);
    assert.equal(h.api.getState().snapshot, snapshot);
    assert.deepEqual(await readTrace(h.home), trace);
    state.choice = { command: 'settings', label: 'Open settings' };
    await mock.commands.executeCommand('codexQuota.menu');
    assert.deepEqual(state.picks.at(-1)!.map(item => item.label), [
      '$(refresh) Refresh quota', '$(account) View account and quota source',
      '$(output) View diagnostic log', '$(settings-gear) Open settings'
    ]);
    assert.equal(state.openedSettings, '@ext:ujyong.codex-quota-monitor-ujyong');
    for (const name of ['selectEnvironment', 'togglePosition', 'selectLanguage']) assert.ok(!state.commands.has(`codexQuota.${name}`));
    await mock.commands.executeCommand('codexQuota.showAccount');
    assert.match(state.messages.at(-1)!, /Account source:.*Codex CLI.*VS Code GitHub/);
    await config.update('language', 'zh-CN', mock.ConfigurationTarget.Workspace);
    assert.match(h.api.getState().tooltip, /账号：fixture@example.test/);
    assert.equal(state.reloads, 0);
  } finally { await h.dispose(); }
});

test('英文 VS Code 默认跟随英语；手动语言覆盖并即时重译缓存错误', async () => {
  const h = await harness({ exitMethod: 'account/rateLimits/read', stderr: 'database is locked SENSITIVE_MOCK_TOKEN' }, { vscodeLanguage: 'en-US' });
  try {
    state.errorAction = 'View diagnostics';
    await h.api.refresh();
    assert.match(h.api.getState().text, /Codex \[Local\].*Query failed/);
    assert.match(h.api.getState().tooltip, /quota read.*exit code 4.*database/);
    assert.equal(state.output.shown, 1);
    assert.equal(JSON.parse(state.output.lines[1]).phase, 'quota read');
    const trace = await readTrace(h.home);
    await workspace.getConfiguration('codexQuota').update('language', 'zh-CN', mock.ConfigurationTarget.Global);
    assert.match(h.api.getState().tooltip, /读取额度.*退出码 4.*数据库/);
    assert.deepEqual(await readTrace(h.home), trace);
    assert.equal(state.errors.length, 1);
    await workspace.getConfiguration('codexQuota').update('language', 'auto', mock.ConfigurationTarget.Global);
    await mock.commands.executeCommand('codexQuota.refresh');
    assert.equal(state.errors.length, 2);
    assert.match(state.errors[1], /Codex quota query failed:.*quota read/);
    assert.doesNotMatch(state.output.lines.join('\n'), /SENSITIVE_MOCK_TOKEN/);
  } finally { await h.dispose(); }
});

test('显示语言以原生设置为准，旧菜单偏好不覆盖设置或触发插件存储写入', async () => {
  const preference = { 'codexQuota.languagePreference': { language: 'zh-CN', configured: 'en' } };
  const h = await harness({}, { language: 'en', globalPreferences: structuredClone(preference), workspacePreferences: structuredClone(preference) });
  try {
    state.storageError = new Error('EACCES SENSITIVE_MOCK_TOKEN');
    await h.api.refresh();
    assert.match(h.api.getState().text, /Codex \[Local\]/);
    const snapshot = h.api.getState().snapshot;
    const trace = await readTrace(h.home);
    await workspace.getConfiguration('codexQuota').update('language', 'auto', mock.ConfigurationTarget.Global);
    assert.match(h.api.getState().text, /Codex \[本地\]/);
    assert.equal(h.api.getState().snapshot, snapshot);
    assert.deepEqual(await readTrace(h.home), trace);
    assert.deepEqual(state.globalPreferences, preference);
    assert.deepEqual(state.workspacePreferences, preference);
    assert.equal(state.errors.length, 0);
    assert.equal(state.messages.length, 0);
  } finally { await h.dispose(); }
});

test('同一个扩展在本地和 SSH／WSL／容器／Codespaces 宿主读取各自的 CLI 账号', async () => {
  const unrelated = await scenarioHome({ account: { type: 'chatgpt', email: 'unrelated@example.test', planType: 'plus' } });
  try {
    for (const remoteName of [undefined, 'ssh-remote', 'wsl', 'dev-container', 'codespaces']) {
      const email = remoteName ? `${remoteName}@example.test` : 'local@example.test';
      const h = await harness({ account: { type: 'chatgpt', email, planType: 'pro' } }, { remoteName });
      try {
        await h.api.refresh();
        assert.equal(h.api.getState().target, remoteName ? 'remote' : 'local');
        assert.match(h.api.getState().text, remoteName ? /Codex \[远程\]/ : /Codex \[本地\]/);
        assert.ok(h.api.getState().tooltip.includes(email));
        assert.equal(h.api.getState().snapshot?.codexHome, h.home);
        assert.ok((await readTrace(h.home)).some(row => row.method === 'account/rateLimits/read'));
        await assert.rejects(readTrace(unrelated), { code: 'ENOENT' });
        assert.equal(state.installs.length, 0);
        assert.equal(state.reloads, 0);
        assert.ok(!state.commands.has('codexQuota.selectEnvironment'));
        await mock.commands.executeCommand('codexQuota.menu');
        assert.ok(!state.picks.at(-1)?.some(item => item.label.includes('选择本地')));
        await mock.commands.executeCommand('codexQuota.showAccount');
        assert.match(state.messages.at(-1)!, remoteName ? /查询宿主：远程/ : /查询宿主：本地/);
        if (remoteName) assert.ok(state.messages.at(-1)!.includes(remoteName));
      } finally { await h.dispose(); }
    }
  } finally { await cleanup(unrelated); }
});

test('旧环境选择不改变实际宿主，不写用户的扩展宿主覆盖配置', async () => {
  const h = await harness({}, { legacyKinds: true });
  try {
    await h.api.refresh();
    const snapshot = h.api.getState().snapshot;
    const trace = await readTrace(h.home);
    state.settings.executionEnvironment = 'remote'; fire('codexQuota.executionEnvironment');
    await h.api.refresh();
    assert.equal(h.api.getState().target, 'local');
    assert.deepEqual(state.kinds, { 'other.extension': ['ui'], 'jyongli.codex-quota-vscode': ['workspace'] });
    assert.equal(state.updates.length, 0);
    assert.equal(snapshot?.codexHome, h.home);
    assert.equal((await readTrace(h.home)).length, trace.length * 2);
  } finally { await h.dispose(); }
});

test('升级兼容旧远程路径，新机器级设置优先；本地从不使用旧远程路径', async () => {
  const otherHome = await scenarioHome({ account: { type: 'chatgpt', email: 'other@example.test', planType: 'pro' } });
  const h = await harness({ account: { type: 'chatgpt', email: 'legacy@example.test', planType: 'plus' } }, { remoteName: 'ssh-remote', legacyRemote: true });
  try {
    await h.api.refresh();
    assert.match(h.api.getState().tooltip, /legacy@example.test/);
    state.settings.cliPath = fixtureCli; state.settings.codexHome = otherHome; fire('codexQuota.codexHome');
    await h.api.refresh();
    assert.match(h.api.getState().tooltip, /other@example.test/);
    assert.equal(state.settings.remoteCodexHome, h.home);
  } finally { await h.dispose(); }
  const local = await harness({});
  try {
    state.settings.remoteCliPath = 'missing-remote-cli'; state.settings.remoteCodexHome = otherHome;
    await local.api.refresh();
    assert.match(local.api.getState().tooltip, /fixture@example.test/);
    assert.equal(local.api.getState().snapshot?.codexHome, local.home);
  } finally { await local.dispose(); await cleanup(otherHome); }
});

test('远程宿主失败时提供本机诊断，语言切换不重新查询；不退回本地账号', async () => {
  const h = await harness({ exitMethod: 'initialize', stderr: 'TOML parse error SENSITIVE_MOCK_TOKEN' }, { remoteName: 'ssh-remote', language: 'en' });
  try {
    await h.api.refresh();
    assert.equal(h.api.getState().target, 'remote');
    assert.equal(h.api.getState().snapshot, undefined);
    assert.match(h.api.getState().tooltip, /CLI startup and initialization.*exit code 4.*configuration/);
    assert.match(h.api.getState().text, /Codex \[Remote\]/);
    const trace = await readTrace(h.home);
    await workspace.getConfiguration('codexQuota').update('language', 'zh-CN', mock.ConfigurationTarget.Global);
    assert.match(h.api.getState().tooltip, /启动并初始化 CLI.*退出码 4.*配置/);
    assert.deepEqual(await readTrace(h.home), trace);
    assert.doesNotMatch(state.output.lines.join('\n'), /SENSITIVE_MOCK_TOKEN/);
    assert.equal(state.installs.length, 0);
  } finally { await h.dispose(); }
});

test('公网 IP 在实际宿主查询，显示开关停止请求且语言切换保留地址', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('203.0.113.42'); };
  const h = await harness({}, { publicIp: true, remoteName: 'ssh-remote' });
  try {
    await h.api.refresh();
    assert.ok(calls > 0);
    assert.equal(h.api.getState().snapshot?.publicIp, '203.0.113.42');
    assert.match(h.api.getState().tooltip, /IP 地址：.+\n公网 IP：203\.0\.113\.42/);
    assert.equal(h.api.getState().snapshot?.codexHome, h.home);
    await workspace.getConfiguration('codexQuota').update('language', 'en', mock.ConfigurationTarget.Global);
    assert.match(h.api.getState().tooltip, /Public IP: 203\.0\.113\.42/);
    const before = calls;
    state.settings.showPublicIp = false; fire('codexQuota.showPublicIp');
    await h.api.refresh();
    assert.doesNotMatch(h.api.getState().tooltip, /Public IP:/);
    assert.equal(calls, before);
    assert.equal(state.installs.length, 0);
  } finally { await h.dispose(); globalThis.fetch = originalFetch; }
});
