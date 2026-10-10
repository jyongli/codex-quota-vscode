import * as vscode from 'vscode';
import { queryCodex, Snapshot } from './cli';
import { activeTarget, ExtensionKinds, hostLabel, selectedTarget, withTarget, ExecutionTarget } from './environment';
import { accountText, quotaText, QuotaWindow } from './quota';

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
  private readonly target: ExecutionTarget;
  private readonly extensionId: string;
  private readonly runtimeDirectory: string;

  constructor(context: vscode.ExtensionContext) {
    this.extensionId = context.extension.id;
    this.runtimeDirectory = context.globalStorageUri.fsPath;
    this.target = activeTarget(context.extension.extensionKind === vscode.ExtensionKind.Workspace, vscode.env.remoteName);
    this.createBar();
    const commands: Record<string, () => unknown> = {
      'codexQuota.menu': () => this.menu(),
      'codexQuota.refresh': () => this.refresh(),
      'codexQuota.selectEnvironment': () => this.selectEnvironment(),
      'codexQuota.togglePosition': () => this.togglePosition(),
      'codexQuota.showAccount': () => this.showAccount()
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
      if (event.affectsConfiguration('remote.extensionKind') ||
          ['cliPath', 'codexHome', 'refreshIntervalSeconds', 'requestTimeoutSeconds'].some(key => event.affectsConfiguration(`codexQuota.${key}`))) {
        this.invalidate();
        this.startPolling();
      }
    }));
    this.startPolling();
  }

  private config(): vscode.WorkspaceConfiguration { return vscode.workspace.getConfiguration('codexQuota'); }

  private position(): 'left' | 'right' { return this.config().get('statusBarPosition') === 'left' ? 'left' : 'right'; }

  private createBar(): void {
    this.bar?.dispose();
    this.bar = vscode.window.createStatusBarItem('codexQuota.status', this.position() === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right, 20);
    this.bar.name = 'Codex Quota';
    this.bar.command = 'codexQuota.menu';
    this.bar.show();
  }

  private hostKinds(): ExtensionKinds {
    return vscode.workspace.getConfiguration('remote').get<ExtensionKinds>('extensionKind', {});
  }

  private pendingReason(): string | undefined {
    if (!vscode.workspace.isTrusted) return '请先信任工作区';
    const desired = selectedTarget(this.hostKinds(), this.extensionId);
    if (desired === 'remote' && !vscode.env.remoteName) return '未连接远程环境';
    if (desired !== this.target) return '环境切换待重载';
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
    const seconds = Math.max(60, Math.min(3600, Number(this.config().get('refreshIntervalSeconds', 300)) || 300));
    this.interval = setInterval(() => { void this.refresh(); }, seconds * 1000);
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
    const timeout = Math.max(5, Math.min(120, Number(this.config().get('requestTimeoutSeconds', 20)) || 20));
    const job = (async () => {
      try {
        const snapshot = await queryCodex({
          cliPath: this.config().get('cliPath', 'codex'),
          codexHome: this.config().get('codexHome', ''), timeoutMs: timeout * 1000,
          runtimeDirectory: this.runtimeDirectory
        }, abort.signal);
        if (this.disposed || generation !== this.generation) return;
        this.snapshot = snapshot;
        this.error = undefined;
      } catch (error) {
        if (this.disposed || generation !== this.generation) return;
        // Remove old values on failure so they cannot be mistaken for current quota.
        this.snapshot = undefined;
        this.error = error instanceof Error ? error.message : '额度查询失败。';
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
    const host = hostLabel(this.target, vscode.env.remoteName);
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
    const lines = ['Codex 剩余额度', `实际执行环境：${host}`, '数据来源：官方 Codex CLI app-server / account/rateLimits/read'];
    if (pending) lines.push(pending, '使用“选择本地／远程环境”，在目标端安装同一 VSIX 后重载窗口。');
    else if (this.error) lines.push(this.error, '旧额度已清除；可点击状态栏重试或查看设置。');
    else if (this.snapshot) {
      const snapshot = this.snapshot;
      lines.push(`账号：${singleLine(accountText(snapshot.account))}`,
        '账号来源：该执行环境的 Codex CLI 当前登录状态（account/read），不是 VS Code 的 GitHub 账号。',
        `CLI：${singleLine(snapshot.cliPath)}`, `Codex 配置目录：${singleLine(snapshot.codexHome)}`,
        '凭据由 Codex 管理（配置目录或系统凭据存储）；插件不读取 auth.json。');
      if (snapshot.quota) {
        lines.push(`剩余：${quotaText(snapshot.quota)}`);
        if (snapshot.quota.fiveHour) lines.push(resetText('5 小时额度', snapshot.quota.fiveHour));
        lines.push(resetText('周额度', snapshot.quota.weekly));
        if (!snapshot.quota.weekly) lines.push('接口没有返回明确的周窗口；— 表示未知，不能视为 100%。');
        if (snapshot.quota.accountId) lines.push(`额度账号 ID：${singleLine(snapshot.quota.accountId)}`);
      }
      lines.push(`查询时间：${snapshot.checkedAt.toLocaleString()}`);
    }
    this.bar.tooltip = lines.join('\n');
    this.bar.accessibilityInformation = { label: this.bar.text.replace(/\$\([^)]+\)/g, '') };
  }

  getState(): ExtensionState {
    return { text: this.bar.text, tooltip: String(this.bar.tooltip ?? ''), alignment: this.position(), target: this.target, snapshot: this.snapshot };
  }

  private async togglePosition(): Promise<void> {
    await this.config().update('statusBarPosition', this.position() === 'left' ? 'right' : 'left', vscode.ConfigurationTarget.Global);
  }

  private async selectEnvironment(): Promise<void> {
    const selection = await vscode.window.showQuickPick([
      { label: '本地', description: '本机 Codex CLI 和登录账号', target: 'local' as const },
      { label: '远程', description: 'SSH / WSL / Dev Container / Codespaces 宿主中的 Codex CLI 和登录账号', target: 'remote' as const }
    ], { title: '选择 Codex 额度查询环境', placeHolder: `当前实际执行环境：${hostLabel(this.target, vscode.env.remoteName)}` });
    if (!selection) return;
    if (selection.target === 'remote' && !vscode.env.remoteName) {
      await vscode.window.showWarningMessage('请先连接 VS Code 远程工作区，并在远程端安装同一 Codex Quota VSIX。');
      return;
    }
    const remoteConfig = vscode.workspace.getConfiguration('remote');
    // Preserve other extensions' user-level host preferences.
    const globalKinds = remoteConfig.inspect<ExtensionKinds>('extensionKind')?.globalValue ?? {};
    await remoteConfig.update('extensionKind', withTarget(globalKinds, this.extensionId, selection.target), vscode.ConfigurationTarget.Global);
    if (selection.target !== this.target) {
      const action = await vscode.window.showInformationMessage(
        `已选择${selection.label}。请确认该端已安装同一 VSIX；重载后从该端的 Codex CLI 查询。`, '重载窗口'
      );
      if (action === '重载窗口') await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }

  private async showAccount(): Promise<void> {
    await this.refresh();
    await vscode.window.showInformationMessage(String(this.bar.tooltip ?? ''), { modal: true });
  }

  private async menu(): Promise<void> {
    const choice = await vscode.window.showQuickPick([
      { label: '$(refresh) 刷新额度', command: 'codexQuota.refresh' },
      { label: '$(account) 查看账号与额度来源', command: 'codexQuota.showAccount' },
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
    for (const subscription of this.subscriptions) subscription.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): QuotaApi {
  const controller = new QuotaController(context);
  context.subscriptions.push(controller);
  return controller;
}
