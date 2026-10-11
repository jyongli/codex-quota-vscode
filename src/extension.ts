import * as vscode from 'vscode';
import { CodexQueryError, queryCodex, Snapshot } from './cli';
import { activeTarget, hostIpAddress, ExecutionTarget } from './environment';
import { accountText, quotaText, QuotaWindow } from './quota';
import { errorMessage, Language, Message, MessageKey, resolveLanguage, t, text } from './i18n';
import { getPublicIp } from './publicIp';
import { ensureCli } from './cliInstall';
import { discoverSources, QuerySource, selectedSource } from './sources';

export interface ExtensionState {
  text: string;
  tooltip: string;
  alignment: 'left' | 'right';
  target: ExecutionTarget;
  snapshot?: Snapshot;
  sources: { id: string; kind: 'cli' | 'ide'; name?: string }[];
  selectedSource?: string;
}

export interface QuotaApi {
  refresh(): Promise<void>;
  getState(): ExtensionState;
}

function settingFailureHint(error: unknown): MessageKey {
  // Classify editor errors without exposing raw messages, file contents or paths.
  const message = error instanceof Error ? error.message : '';
  if (/json|syntax|errors\/warnings|errors in|contains errors|解析|语法/i.test(message)) return 'settingsInvalid';
  if (/dirty|unsaved|save.*settings.*first|未保存/i.test(message)) return 'settingsUnsaved';
  if (/permission|read.?only|eacces|eperm|access.*denied|权限|只读|拒绝访问/i.test(message)) return 'settingsReadOnly';
  if (/policy|managed|策略/i.test(message)) return 'settingsManaged';
  return 'settingsWriteFailed';
}

function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\$\(/g, '(');
}

function resetText(label: string, window: QuotaWindow | undefined, language: Language): string {
  return t(language, 'reset', { label, value: window?.resetsAt ? new Date(window.resetsAt * 1000).toLocaleString(language) : t(language, 'notProvided') });
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
  private error?: Message;
  private loading = false;
  private installing = false;
  private readonly storagePath: string;
  private readonly extensionId: string;
  private readonly target: ExecutionTarget;
  private readonly output: vscode.OutputChannel;
  private notifiedError?: string;
  private notificationCount = 0;
  private sources: QuerySource[] = [];
  private selection?: string;
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.selection = context.workspaceState.get<string>('selectedSource');
    this.storagePath = context.globalStorageUri.fsPath;
    this.extensionId = context.extension.id;
    this.output = vscode.window.createOutputChannel('Codex Quota');
    this.target = activeTarget(context.extension.extensionKind === vscode.ExtensionKind.Workspace, vscode.env.remoteName);
    this.createBar();
    const commands: Record<string, () => unknown> = {
      'codexQuota.menu': () => this.menu(),
      'codexQuota.refresh': () => this.manualRefresh(),
      'codexQuota.showAccount': () => this.showAccount(),
      'codexQuota.showDiagnostics': () => this.output.show(true),
      'codexQuota.selectSource': () => this.selectSource()
    };
    for (const [name, action] of Object.entries(commands)) {
      this.subscriptions.push(vscode.commands.registerCommand(name, async () => {
        try { return await action(); } catch (error) {
          this.output.appendLine(`[${new Date().toISOString()}] ${name}: ${this.t(settingFailureHint(error))}`);
          const label = this.t('diagnostics');
          const choice = await vscode.window.showErrorMessage(this.t('settingsFailed'), label);
          if (choice === label && !this.disposed) this.output.show(true);
          return undefined;
        }
      }));
    }
    this.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('codexQuota.language')) {
        this.render();
      }
      if (event.affectsConfiguration('codexQuota.statusBarPosition')) {
        this.createBar();
        this.render();
      }
      if (['cliPath', 'codexHome', 'remoteCliPath', 'remoteCodexHome', 'environments', 'autoInstallCli', 'refreshIntervalSeconds', 'requestTimeoutSeconds', 'showPublicIp'].some(key => event.affectsConfiguration(`codexQuota.${key}`))
        || event.affectsConfiguration('chatgpt.cliExecutable') || event.affectsConfiguration('chatgpt.runCodexInWindowsSubsystemForLinux')) {
        this.invalidate();
        this.startPolling();
      }
    }));
    this.subscriptions.push(vscode.extensions.onDidChange(() => {
      this.invalidate();
      void this.refresh();
    }));
    this.startPolling();
  }

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('codexQuota', vscode.window.activeTextEditor?.document.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri);
  }

  private position(): 'left' | 'right' { return this.config().get('statusBarPosition') === 'left' ? 'left' : 'right'; }

  private language(): Language {
    return resolveLanguage(this.config().get('language', 'auto'), vscode.env.language);
  }

  private t(key: MessageKey, values?: Message['values']): string { return t(this.language(), key, values); }

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

  private hostSetting(key: 'cliPath' | 'codexHome', fallback: string): string {
    const config = this.config();
    // Machine-scoped settings belong to the actual workspace host. Preserve the
    // former remote keys only until the user sets the unified host setting.
    if (this.target === 'remote' && config.inspect(key)?.globalValue === undefined) {
      const legacy = key === 'cliPath' ? 'remoteCliPath' : 'remoteCodexHome';
      return config.get(legacy, fallback);
    }
    return config.get(key, fallback);
  }

  private pendingReason(): string | undefined {
    if (!vscode.workspace.isTrusted) return this.t('trustRequired');
    return undefined;
  }

  private currentSource(): QuerySource | undefined { return selectedSource(this.sources, this.selection); }

  private sourceLabel(source: QuerySource): string {
    return source.kind === 'ide' ? this.t('ideLabel') : source.name ? `CLI / ${singleLine(source.name)}` : 'CLI';
  }

  private async findSources(): Promise<QuerySource[]> {
    const ide = vscode.extensions.getExtension('openai.chatgpt');
    const config = vscode.workspace.getConfiguration('chatgpt');
    return discoverSources(this.hostSetting('cliPath', 'codex'), this.hostSetting('codexHome', ''), this.config().get('environments', []), ide ? {
      path: ide.extensionUri.fsPath,
      sameHost: ide.extensionKind === this.context.extension.extensionKind,
      cliPath: config.get<string | null>('cliExecutable') ?? undefined,
      usesWsl: config.get('runCodexInWindowsSubsystemForLinux', false)
    } : undefined);
  }

  private invalidate(): void {
    this.generation++;
    this.abort?.abort();
    this.running = undefined;
    this.loading = false;
    this.installing = false;
    this.snapshot = undefined;
    this.error = undefined;
  }

  private startPolling(): void {
    if (this.interval) clearInterval(this.interval);
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
    const includePublicIp = this.config().get('showPublicIp', true);
    const job = (async () => {
      try {
        const sources = await this.findSources();
        if (this.disposed || generation !== this.generation) return;
        const previousSource = this.currentSource()?.id;
        this.sources = sources;
        const source = this.currentSource();
        if (previousSource !== source?.id) { this.snapshot = undefined; this.error = undefined; this.render(); }
        if (!source) { this.snapshot = undefined; this.error = undefined; return; }
        const cliPath = await ensureCli({
          cliPath: source.cliPath, storagePath: this.storagePath,
          autoInstall: source.kind === 'cli' && this.config().get('autoInstallCli', true),
          onInstalling: () => {
            if (this.disposed || generation !== this.generation) return;
            this.installing = true;
            this.output.appendLine(`[${new Date().toISOString()}] ${this.t('installingCli')}`);
            this.render();
          }
        }, abort.signal);
        if (abort.signal.aborted) return;
        if (this.installing) this.output.appendLine(`[${new Date().toISOString()}] ${this.t('cliInstalled')}`);
        this.installing = false;
        this.render();
        const [quota, publicIp] = await Promise.all([queryCodex({
          cliPath,
          codexHome: source.codexHome, timeoutMs: timeout * 1000
        }, abort.signal), includePublicIp ? getPublicIp(abort.signal) : Promise.resolve(undefined)]);
        const snapshot = { ...quota, hostIp: hostIpAddress(), publicIp };
        if (this.disposed || generation !== this.generation) return;
        this.snapshot = snapshot;
        this.error = undefined;
        this.notifiedError = undefined;
      } catch (error) {
        if (this.disposed || generation !== this.generation) return;
        // Remove old values on failure so they cannot be mistaken for current quota.
        this.snapshot = undefined;
        this.error = errorMessage(error);
        this.output.appendLine(`[${new Date().toISOString()}] ${text(this.language(), this.error)}`);
        if (error instanceof CodexQueryError) this.output.appendLine(JSON.stringify({
          ...error.diagnostic, phase: error.diagnostic.phaseKey ? this.t(error.diagnostic.phaseKey) : error.diagnostic.phase
        }, null, 2));
        if (JSON.stringify(this.error) !== this.notifiedError) void this.notifyFailure(this.error);
      } finally {
        abort.abort();
        if (!this.disposed && generation === this.generation) {
          this.loading = false;
          this.installing = false;
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
    const language = this.language();
    const source = this.currentSource();
    const prefix = `Codex [${this.sources.length > 1 && source ? this.sourceLabel(source) + ' · ' : ''}${this.t(this.target)}]`;
    const pending = this.pendingReason();
    let summary = this.t('waiting');
    if (pending) summary = pending;
    else if (this.loading) summary = `$(sync~spin) ${this.t(this.installing ? 'installingCli' : 'querying')}`;
    else if (this.sources.length > 1 && !source) summary = this.t('chooseSource');
    else if (this.error) summary = `$(warning) ${this.t('failed')}`;
    else if (this.snapshot) {
      summary = this.snapshot.quota ? quotaText(this.snapshot.quota, language)
        : this.snapshot.account.type === 'signedOut' ? this.t('signedOut')
          : `${this.snapshot.account.type === 'apiKey' ? 'API Key' : 'Bedrock'} · ${this.t('noSubscription')}`;
    }
    this.bar.text = `${prefix} ${summary}`;
    const rawIp = this.snapshot?.hostIp ?? hostIpAddress();
    const ip = !rawIp || rawIp === '未获取到' ? this.t('notAvailable') : language === 'en' ? rawIp.replace(/、/g, ', ') : rawIp;
    const lines = [this.t('title'), this.t('ip', { value: singleLine(ip) })];
    if (this.sources.length > 1) lines.push(this.t('activeSource', { value: source ? this.sourceLabel(source) : this.t('chooseSource') }));
    if (this.config().get('showPublicIp', true)) lines.push(this.t('publicIp', { value: this.snapshot?.publicIp ?? this.t('notAvailable') }));
    if (pending) lines.push(pending, this.t('trustToQuery'));
    else if (this.error) lines.push(text(language, this.error), this.t('cleared'));
    else if (this.snapshot) {
      const snapshot = this.snapshot;
      lines.push(this.t('account', { value: singleLine(accountText(snapshot.account, language)) }));
      if (snapshot.quota) {
        lines.push(this.t('remaining', { value: quotaText(snapshot.quota, language) }));
        if (snapshot.quota.fiveHour) lines.push(resetText(this.t('fiveHourQuota'), snapshot.quota.fiveHour, language));
        lines.push(resetText(this.t('weeklyQuota'), snapshot.quota.weekly, language));
        if (!snapshot.quota.weekly) lines.push(this.t('unknownWeek'));
        if (snapshot.quota.accountId) lines.push(this.t('accountId', { value: singleLine(snapshot.quota.accountId) }));
      }
      lines.push(this.t('checkedAt', { value: snapshot.checkedAt.toLocaleString(language) }));
      if (snapshot.account.type === 'signedOut') lines.push(this.t('loginHint'));
    }
    const seconds = this.refreshSeconds();
    lines.push(this.t('refreshInterval', { value: seconds === 60 ? this.t('minute', { seconds }) : seconds % 60 === 0
      ? this.t('minutes', { minutes: seconds / 60, seconds }) : this.t('seconds', { seconds }) }));
    this.bar.tooltip = lines.join('\n');
    this.bar.accessibilityInformation = { label: this.bar.text.replace(/\$\([^)]+\)/g, '') };
  }

  getState(): ExtensionState {
    return { text: this.bar.text, tooltip: String(this.bar.tooltip ?? ''), alignment: this.position(), target: this.target, snapshot: this.snapshot,
      sources: this.sources.map(({ id, kind, name }) => ({ id, kind, name })), selectedSource: this.currentSource()?.id };
  }

  private async notifyFailure(message: Message): Promise<void> {
    this.notifiedError = JSON.stringify(message);
    this.notificationCount++;
    const label = this.t('diagnostics');
    const action = await vscode.window.showErrorMessage(this.t('queryFailure', { message: text(this.language(), message) }), label);
    if (action === label && !this.disposed) this.output.show(true);
  }

  private async manualRefresh(): Promise<void> {
    const before = this.notificationCount;
    await this.refresh();
    if (this.error && before === this.notificationCount) await this.notifyFailure(this.error);
  }

  private async showAccount(): Promise<void> {
    await this.refresh();
    const lines = [String(this.bar.tooltip ?? '')];
    if (this.snapshot) {
      const host = this.t(this.target) + (this.target === 'remote' ? ` / ${singleLine(vscode.env.remoteName ?? '')}` : '');
      lines.push(this.t('queryHost', { value: host }), this.t(this.currentSource()?.kind === 'ide' ? 'ideSource' : 'source'), this.t('cli', { value: singleLine(this.snapshot.cliPath) }),
        this.t('home', { value: singleLine(this.snapshot.codexHome) }), this.t('credentials'));
    }
    lines.push(this.t('sharedQuota'), this.t('sourceLimits'));
    await vscode.window.showInformationMessage(lines.join('\n'), { modal: true });
  }

  private async menu(): Promise<void> {
    if (this.sources.length > 1 && !this.currentSource()) { await this.selectSource(); return; }
    const choice = await vscode.window.showQuickPick([
      { label: `$(refresh) ${this.t('menuRefresh')}`, command: 'codexQuota.refresh' },
      ...(this.sources.length > 1 ? [{ label: `$(server-environment) ${this.t('chooseSource')}`, command: 'codexQuota.selectSource' }] : []),
      { label: `$(account) ${this.t('menuAccount')}`, command: 'codexQuota.showAccount' },
      { label: `$(output) ${this.t('menuDiagnostics')}`, command: 'codexQuota.showDiagnostics' },
      { label: `$(settings-gear) ${this.t('menuSettings')}`, command: 'settings' }
    ], { title: 'Codex Quota' });
    if (!choice) return;
    if (choice.command === 'settings') await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${this.extensionId}`);
    else await vscode.commands.executeCommand(choice.command);
  }

  private async selectSource(): Promise<void> {
    if (!this.sources.length) await this.refresh();
    if (this.sources.length <= 1) return;
    const choice = await vscode.window.showQuickPick(this.sources.map(source => ({
      label: `${this.sourceLabel(source)} [${this.t(this.target)}]`,
      description: source.id === this.currentSource()?.id ? this.t('currentSource') : undefined,
      detail: this.t('home', { value: singleLine(source.codexHome || this.t('inheritedHome')) }), id: source.id
    })), { title: this.t('chooseSource'), placeHolder: this.t('sourceChoiceHint') });
    if (!choice || choice.id === this.currentSource()?.id || !this.sources.some(source => source.id === choice.id)) return;
    this.invalidate();
    this.selection = choice.id;
    // A read-only settings file does not block selection. Persist only the
    // source ID, never account details, quota or credentials.
    try { await this.context.workspaceState.update('selectedSource', choice.id); }
    catch { this.output.appendLine(this.t('selectionNotSaved')); }
    await this.refresh();
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
  const controller = new QuotaController(context);
  context.subscriptions.push(controller);
  return controller;
}
