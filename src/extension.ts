import * as vscode from 'vscode';
import { CodexQueryError, queryCodex, Snapshot } from './cli';
import { ExtensionKinds, hostIpAddress, selectedTarget, ExecutionTarget } from './environment';
import { accountText, quotaText, QuotaWindow } from './quota';
import { queryRemote } from './remoteClient';

export interface ExtensionState {
  text: string;
  tooltip: string;
  alignment: 'left' | 'right';
  target: ExecutionTarget;
  snapshot?: Snapshot;
}

export interface QuotaApi {
  refresh(): Promise<void>;
  getState(): ExtensionState;
}

function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\$\(/g, '(');
}

function resetText(label: string, window: QuotaWindow | undefined): string {
  return `${label}重置：${window?.resetsAt ? new Date(window.resetsAt * 1000).toLocaleString() : '接口未提供'}`;
}

class QuotaController implements vscode.Disposable, QuotaApi {
  private bar!: vscode.StatusBarItem;
  private readonly subscriptions: vscode.Disposable[] = [];
  private interval?: ReturnType<typeof setInterval>;
  private abort?: AbortController;
  private running?: Promise<void>;
  private generation = 0;
  private disposed = false;
  private snapshot?: Snapshot;
  private error?: string;
  private loading = false;
  private target: ExecutionTarget;
  private readonly misplacedHost: boolean;
  private readonly output: vscode.OutputChannel;
  private notifiedError?: string;
  private notificationCount = 0;

  constructor(context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel('Codex Quota');
    this.target = this.selectedEnvironment();
    this.misplacedHost = context.extension.extensionKind === vscode.ExtensionKind.Workspace && !!vscode.env.remoteName;
    this.createBar();
    const commands: Record<string, () => unknown> = {
      'codexQuota.menu': () => this.menu(),
      'codexQuota.refresh': () => this.manualRefresh(),
      'codexQuota.selectEnvironment': () => this.selectEnvironment(),
      'codexQuota.togglePosition': () => this.togglePosition(),
      'codexQuota.showAccount': () => this.showAccount(),
      'codexQuota.showDiagnostics': () => this.output.show(true)
    };
    for (const [name, action] of Object.entries(commands)) {
      this.subscriptions.push(vscode.commands.registerCommand(name, async () => {
        try { return await action(); } catch {
          await vscode.window.showErrorMessage('Codex Quota 无法保存设置；请检查用户设置是否可写。');
          return undefined;
        }
      }));
    }
    this.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('codexQuota.statusBarPosition')) {
        this.createBar();
        this.render();
      }
      if (['executionEnvironment', 'cliPath', 'codexHome', 'remoteCliPath', 'remoteCodexHome', 'refreshIntervalSeconds', 'requestTimeoutSeconds'].some(key => event.affectsConfiguration(`codexQuota.${key}`))) {
        this.invalidate();
        this.startPolling();
      }
    }));
    this.startPolling();
  }

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('codexQuota', vscode.window.activeTextEditor?.document.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri);
  }

  private position(): 'left' | 'right' { return this.config().get('statusBarPosition') === 'left' ? 'left' : 'right'; }

  private refreshSeconds(): number {
    return Math.max(60, Math.min(3600, Number(this.config().get('refreshIntervalSeconds', 300)) || 300));
  }

  private createBar(): void {
    this.bar?.dispose();
    this.bar = vscode.window.createStatusBarItem('codexQuota.status', this.position() === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right, 20);
    this.bar.name = 'Codex Quota';
    this.bar.command = 'codexQuota.menu';
    this.bar.show();
  }

  private selectedEnvironment(): ExecutionTarget {
    return this.config().get<ExecutionTarget>('executionEnvironment', 'local') === 'remote' ? 'remote' : 'local';
  }

  private settingTarget(key: string): vscode.ConfigurationTarget {
    const inspected = this.config().inspect(key);
    // Both settings have `window` scope; a single-folder window can expose the
    // same value as workspaceFolderValue, but these settings cannot be written there.
    return inspected?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  }

  private pendingReason(): string | undefined {
    if (!vscode.workspace.isTrusted) return '请先信任工作区';
    if (this.misplacedHost) return '主插件需在本地运行';
    if (this.target === 'remote' && !vscode.env.remoteName) return '未连接远程环境';
    return undefined;
  }

  private invalidate(): void {
    this.generation++;
    this.abort?.abort();
    this.running = undefined;
    this.loading = false;
    this.snapshot = undefined;
    this.error = undefined;
  }

  private startPolling(): void {
    if (this.interval) clearInterval(this.interval);
    this.target = this.selectedEnvironment();
    this.interval = setInterval(() => { void this.refresh(); }, this.refreshSeconds() * 1000);
    void this.refresh();
  }

  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.pendingReason()) { this.render(); return Promise.resolve(); }
    if (this.running) return this.running;
    const generation = this.generation;
    const abort = new AbortController();
    this.abort = abort;
    this.loading = true;
    this.render();
    const timeout = Math.max(5, Math.min(120, Number(this.config().get('requestTimeoutSeconds', 60)) || 60));
    const job = (async () => {
      try {
        const snapshot = this.target === 'remote'
          ? await queryRemote((command, argument) => vscode.commands.executeCommand(command, argument), vscode.env.remoteName!, timeout * 1000, abort.signal)
          : { ...await queryCodex({
            cliPath: this.config().get('cliPath', 'codex'),
            codexHome: this.config().get('codexHome', ''), timeoutMs: timeout * 1000
          }, abort.signal), hostIp: hostIpAddress() };
        if (this.disposed || generation !== this.generation) return;
        this.snapshot = snapshot;
        this.error = undefined;
        this.notifiedError = undefined;
      } catch (error) {
        if (this.disposed || generation !== this.generation) return;
        // Remove old values on failure so they cannot be mistaken for current quota.
        this.snapshot = undefined;
        this.error = error instanceof Error ? error.message : '额度查询失败。';
        this.output.appendLine(`[${new Date().toISOString()}] ${this.error}`);
        if (error instanceof CodexQueryError) this.output.appendLine(JSON.stringify(error.diagnostic, null, 2));
        if (this.error !== this.notifiedError) void this.notifyFailure(this.error);
      } finally {
        if (!this.disposed && generation === this.generation) {
          this.loading = false;
          this.running = undefined;
          this.render();
        }
      }
    })();
    this.running = job;
    return job;
  }

  private render(): void {
    if (this.disposed) return;
    const prefix = `Codex [${this.target === 'local' ? '本地' : '远程'}]`;
    const pending = this.pendingReason();
    let summary = '等待刷新';
    if (pending) summary = pending;
    else if (this.loading) summary = '$(sync~spin) 查询中';
    else if (this.error) summary = '$(warning) 查询失败';
    else if (this.snapshot) {
      summary = this.snapshot.quota ? quotaText(this.snapshot.quota)
        : this.snapshot.account.type === 'signedOut' ? '未登录'
          : this.snapshot.account.type === 'apiKey' ? 'API Key · 无订阅额度' : 'Bedrock · 无订阅额度';
    }
    this.bar.text = `${prefix} ${summary}`;
    const ip = this.snapshot?.hostIp ?? (this.target === 'local' ? hostIpAddress() : '未获取到');
    const lines = ['Codex 剩余额度', `IP 地址：${singleLine(ip)}`];
    if (pending) lines.push(pending, this.misplacedHost
      ? '请在本地端安装新版 Codex Quota 主插件并完成首次升级。'
      : this.target === 'remote' ? '请连接远程工作区，并在远程端安装 Codex Quota Remote 查询组件。' : '信任工作区后可查询额度。');
    else if (this.error) lines.push(this.error, '旧额度已清除；可点击状态栏重试或查看设置。');
    else if (this.snapshot) {
      const snapshot = this.snapshot;
      lines.push(`账号：${singleLine(accountText(snapshot.account))}`);
      if (snapshot.quota) {
        lines.push(`剩余：${quotaText(snapshot.quota)}`);
        if (snapshot.quota.fiveHour) lines.push(resetText('5 小时额度', snapshot.quota.fiveHour));
        lines.push(resetText('周额度', snapshot.quota.weekly));
        if (!snapshot.quota.weekly) lines.push('接口没有返回明确的周窗口；— 表示未知，不能视为 100%。');
        if (snapshot.quota.accountId) lines.push(`额度账号 ID：${singleLine(snapshot.quota.accountId)}`);
      }
      lines.push(`查询时间：${snapshot.checkedAt.toLocaleString()}`);
    }
    const seconds = this.refreshSeconds();
    lines.push(`刷新时间间隔：${seconds % 60 === 0 ? `${seconds / 60} 分钟（${seconds} 秒）` : `${seconds} 秒`}`);
    this.bar.tooltip = lines.join('\n');
    this.bar.accessibilityInformation = { label: this.bar.text.replace(/\$\([^)]+\)/g, '') };
  }

  getState(): ExtensionState {
    return { text: this.bar.text, tooltip: String(this.bar.tooltip ?? ''), alignment: this.position(), target: this.target, snapshot: this.snapshot };
  }

  private async notifyFailure(message: string): Promise<void> {
    this.notifiedError = message;
    this.notificationCount++;
    const action = await vscode.window.showErrorMessage(`Codex 额度查询失败：${message}`, '查看诊断');
    if (action === '查看诊断' && !this.disposed) this.output.show(true);
  }

  private async manualRefresh(): Promise<void> {
    const before = this.notificationCount;
    await this.refresh();
    if (this.error && before === this.notificationCount) await this.notifyFailure(this.error);
  }

  private async togglePosition(): Promise<void> {
    await this.config().update('statusBarPosition', this.position() === 'left' ? 'right' : 'left', this.settingTarget('statusBarPosition'));
    const alignment = this.position() === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
    if (this.bar.alignment !== alignment) { this.createBar(); this.render(); }
  }

  private async selectEnvironment(): Promise<void> {
    const selection = await vscode.window.showQuickPick([
      { label: '本地', description: '本机 Codex CLI 和登录账号', target: 'local' as const },
      { label: '远程', description: 'SSH / WSL / Dev Container / Codespaces 宿主中的 Codex CLI 和登录账号', target: 'remote' as const }
    ], { title: '选择 Codex 额度查询环境', placeHolder: `当前查询环境：${this.target === 'local' ? '本地' : '远程'}` });
    if (!selection) return;
    if (selection.target === 'remote' && !vscode.env.remoteName) {
      await vscode.window.showWarningMessage('请先连接 VS Code 远程工作区，并在远程端安装 Codex Quota Remote 查询组件。');
      return;
    }
    await this.config().update('executionEnvironment', selection.target, this.settingTarget('executionEnvironment'));
    await this.manualRefresh();
  }

  private async showAccount(): Promise<void> {
    await this.refresh();
    const lines = [String(this.bar.tooltip ?? '')];
    if (this.snapshot) {
      lines.push('账号来源：该执行环境的 Codex CLI 当前登录状态（account/read），不是 VS Code 的 GitHub 账号。',
        `CLI：${singleLine(this.snapshot.cliPath)}`, `Codex 配置目录：${singleLine(this.snapshot.codexHome)}`,
        '凭据由 Codex 管理（配置目录或系统凭据存储）；插件不读取 auth.json。');
    }
    await vscode.window.showInformationMessage(lines.join('\n'), { modal: true });
  }

  private async menu(): Promise<void> {
    const choice = await vscode.window.showQuickPick([
      { label: '$(refresh) 刷新额度', command: 'codexQuota.refresh' },
      { label: '$(account) 查看账号与额度来源', command: 'codexQuota.showAccount' },
      { label: '$(output) 查看诊断日志', command: 'codexQuota.showDiagnostics' },
      { label: '$(remote) 选择本地／远程环境', command: 'codexQuota.selectEnvironment' },
      { label: '$(arrow-swap) 切换状态栏左右位置', command: 'codexQuota.togglePosition' },
      { label: '$(settings-gear) 打开设置', command: 'settings' }
    ], { title: 'Codex Quota' });
    if (!choice) return;
    if (choice.command === 'settings') await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:jyongli.codex-quota-vscode');
    else await vscode.commands.executeCommand(choice.command);
  }

  dispose(): void {
    this.disposed = true;
    this.invalidate();
    if (this.interval) clearInterval(this.interval);
    this.bar.dispose();
    this.output.dispose();
    for (const subscription of this.subscriptions) subscription.dispose();
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<QuotaApi> {
  // Migrate only this extension's old host preference; other extensions keep their settings.
  const remote = vscode.workspace.getConfiguration('remote');
  const kinds = remote.inspect<ExtensionKinds>('extensionKind')?.globalValue ?? {};
  if (kinds[context.extension.id]) {
    const config = vscode.workspace.getConfiguration('codexQuota');
    const inspected = config.inspect('executionEnvironment');
    if (inspected?.globalValue === undefined && inspected?.workspaceValue === undefined && inspected?.workspaceFolderValue === undefined) {
      await config.update('executionEnvironment', selectedTarget(kinds, context.extension.id), vscode.ConfigurationTarget.Global);
    }
    const otherKinds = { ...kinds }; delete otherKinds[context.extension.id];
    await remote.update('extensionKind', otherKinds, vscode.ConfigurationTarget.Global);
  }
  const controller = new QuotaController(context);
  context.subscriptions.push(controller);
  return controller;
}
