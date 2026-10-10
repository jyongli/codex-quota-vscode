import * as vscode from 'vscode';
import { CodexQueryError, queryCodex, Snapshot } from './cli';
import { activeTarget, hostIpAddress, ExecutionTarget } from './environment';
import { accountText, quotaText, QuotaWindow } from './quota';
import { errorMessage, Language, LanguageSetting, Message, MessageKey, resolveLanguage, t, text } from './i18n';
import { getPublicIp } from './publicIp';

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

const LANGUAGE_PREFERENCE = 'codexQuota.languagePreference';
interface LanguagePreference { language: LanguageSetting; configured: LanguageSetting }

function validPreference(value: LanguagePreference | undefined): LanguagePreference | undefined {
  return value && ['auto', 'zh-CN', 'en'].includes(value.language) && ['auto', 'zh-CN', 'en'].includes(value.configured) ? value : undefined;
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
  private readonly target: ExecutionTarget;
  private readonly output: vscode.OutputChannel;
  private notifiedError?: string;
  private notificationCount = 0;
  private languagePreference?: LanguagePreference;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.languagePreference = validPreference(context.workspaceState.get<LanguagePreference>(LANGUAGE_PREFERENCE))
      ?? validPreference(context.globalState.get<LanguagePreference>(LANGUAGE_PREFERENCE));
    this.output = vscode.window.createOutputChannel('Codex Quota');
    this.target = activeTarget(context.extension.extensionKind === vscode.ExtensionKind.Workspace, vscode.env.remoteName);
    this.createBar();
    const commands: Record<string, () => unknown> = {
      'codexQuota.menu': () => this.menu(),
      'codexQuota.refresh': () => this.manualRefresh(),
      'codexQuota.togglePosition': () => this.togglePosition(),
      'codexQuota.selectLanguage': () => this.selectLanguage(),
      'codexQuota.showAccount': () => this.showAccount(),
      'codexQuota.showDiagnostics': () => this.output.show(true)
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
        this.clearLanguagePreference();
        this.render();
      }
      if (event.affectsConfiguration('codexQuota.statusBarPosition')) {
        this.createBar();
        this.render();
      }
      if (['cliPath', 'codexHome', 'remoteCliPath', 'remoteCodexHome', 'refreshIntervalSeconds', 'requestTimeoutSeconds', 'showPublicIp'].some(key => event.affectsConfiguration(`codexQuota.${key}`))) {
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

  private language(): Language {
    const configured = this.config().get<LanguageSetting>('language', 'auto');
    return resolveLanguage(this.languagePreference?.configured === configured ? this.languagePreference.language : configured, vscode.env.language);
  }

  private clearLanguagePreference(): void {
    this.languagePreference = undefined;
    for (const store of [this.context.workspaceState, this.context.globalState]) {
      if (store.get(LANGUAGE_PREFERENCE) !== undefined) {
        void Promise.resolve(store.update(LANGUAGE_PREFERENCE, undefined)).catch(() => {
          if (!this.disposed) this.output.appendLine(this.t('languagePreferenceCleanupFailed'));
        });
      }
    }
  }

  private languageNotice(key: 'languageSavedLocally' | 'languageSessionOnly'): void {
    const label = this.t('diagnostics');
    const notice = key === 'languageSessionOnly'
      ? vscode.window.showWarningMessage(this.t(key), label)
      : vscode.window.showInformationMessage(this.t(key), label);
    void Promise.resolve(notice).then(choice => {
      if (choice === label && !this.disposed) this.output.show(true);
    }).catch(() => {});
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

  private settingTarget(key: string): vscode.ConfigurationTarget {
    const inspected = this.config().inspect(key);
    // These settings have `window` scope; a single-folder window can expose the
    // same value as workspaceFolderValue, but these settings cannot be written there.
    return inspected?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  }

  private pendingReason(): string | undefined {
    if (!vscode.workspace.isTrusted) return this.t('trustRequired');
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
        const [quota, publicIp] = await Promise.all([queryCodex({
          cliPath: this.hostSetting('cliPath', 'codex'),
          codexHome: this.hostSetting('codexHome', ''), timeoutMs: timeout * 1000
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
    const prefix = `Codex [${this.t(this.target)}]`;
    const pending = this.pendingReason();
    let summary = this.t('waiting');
    if (pending) summary = pending;
    else if (this.loading) summary = `$(sync~spin) ${this.t('querying')}`;
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
    }
    const seconds = this.refreshSeconds();
    lines.push(this.t('refreshInterval', { value: seconds === 60 ? this.t('minute', { seconds }) : seconds % 60 === 0
      ? this.t('minutes', { minutes: seconds / 60, seconds }) : this.t('seconds', { seconds }) }));
    this.bar.tooltip = lines.join('\n');
    this.bar.accessibilityInformation = { label: this.bar.text.replace(/\$\([^)]+\)/g, '') };
  }

  getState(): ExtensionState {
    return { text: this.bar.text, tooltip: String(this.bar.tooltip ?? ''), alignment: this.position(), target: this.target, snapshot: this.snapshot };
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

  private async togglePosition(): Promise<void> {
    await this.config().update('statusBarPosition', this.position() === 'left' ? 'right' : 'left', this.settingTarget('statusBarPosition'));
    const alignment = this.position() === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
    if (this.bar.alignment !== alignment) { this.createBar(); this.render(); }
  }

  private async selectLanguage(): Promise<void> {
    const selection = await vscode.window.showQuickPick([
      { label: this.t('autoLanguage'), language: 'auto' as LanguageSetting },
      { label: '中文', language: 'zh-CN' as LanguageSetting },
      { label: 'English', language: 'en' as LanguageSetting }
    ], { title: this.t('menuLanguage'), placeHolder: this.t('currentLanguage', { value: this.language() === 'en' ? 'English' : '中文' }) });
    if (!selection) return;
    const target = this.settingTarget('language');
    try {
      await this.config().update('language', selection.language, target, false);
    } catch (error) {
      const preference: LanguagePreference = { language: selection.language, configured: this.config().get('language', 'auto') };
      const store = target === vscode.ConfigurationTarget.Workspace ? this.context.workspaceState : this.context.globalState;
      this.languagePreference = preference;
      this.render();
      try { await store.update(LANGUAGE_PREFERENCE, preference); }
      catch (storageError) {
        this.output.appendLine(`[${new Date().toISOString()}] codexQuota.language: ${this.t(settingFailureHint(error))} ${this.t(settingFailureHint(storageError))} ${this.t('languageSessionOnly')}`);
        this.languageNotice('languageSessionOnly');
        return;
      }
      this.output.appendLine(`[${new Date().toISOString()}] codexQuota.language: ${this.t(settingFailureHint(error))} ${this.t('languageSavedLocally')}`);
      this.languageNotice('languageSavedLocally');
      return;
    }
    this.clearLanguagePreference();
    this.render();
  }

  private async showAccount(): Promise<void> {
    await this.refresh();
    const lines = [String(this.bar.tooltip ?? '')];
    if (this.snapshot) {
      const host = this.t(this.target) + (this.target === 'remote' ? ` / ${singleLine(vscode.env.remoteName ?? '')}` : '');
      lines.push(this.t('queryHost', { value: host }), this.t('source'), this.t('cli', { value: singleLine(this.snapshot.cliPath) }),
        this.t('home', { value: singleLine(this.snapshot.codexHome) }), this.t('credentials'));
    }
    await vscode.window.showInformationMessage(lines.join('\n'), { modal: true });
  }

  private async menu(): Promise<void> {
    const choice = await vscode.window.showQuickPick([
      { label: `$(refresh) ${this.t('menuRefresh')}`, command: 'codexQuota.refresh' },
      { label: `$(account) ${this.t('menuAccount')}`, command: 'codexQuota.showAccount' },
      { label: `$(output) ${this.t('menuDiagnostics')}`, command: 'codexQuota.showDiagnostics' },
      { label: `$(arrow-swap) ${this.t('menuPosition')}`, command: 'codexQuota.togglePosition' },
      { label: `$(globe) ${this.t('menuLanguage')}`, command: 'codexQuota.selectLanguage' },
      { label: `$(settings-gear) ${this.t('menuSettings')}`, command: 'settings' }
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
  const controller = new QuotaController(context);
  context.subscriptions.push(controller);
  return controller;
}
