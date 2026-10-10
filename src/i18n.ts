export type Language = 'zh-CN' | 'en';
export type LanguageSetting = 'auto' | Language;

const messages = {
  local: ['本地', 'Local'], remote: ['远程', 'Remote'], unknown: ['未知', 'Unknown'],
  notAvailable: ['未获取到', 'Unavailable'], notProvided: ['接口未提供', 'Not provided by the API'],
  title: ['Codex 剩余额度', 'Codex quota remaining'],
  ip: ['IP 地址：{value}', 'IP address: {value}'],
  publicIp: ['公网 IP：{value}', 'Public IP: {value}'],
  account: ['账号：{value}', 'Account: {value}'],
  remaining: ['剩余：{value}', 'Remaining: {value}'],
  accountId: ['额度账号 ID：{value}', 'Quota account ID: {value}'],
  checkedAt: ['查询时间：{value}', 'Last checked: {value}'],
  refreshInterval: ['刷新时间间隔：{value}', 'Refresh interval: {value}'],
  minutes: ['{minutes} 分钟（{seconds} 秒）', '{minutes} minutes ({seconds} seconds)'],
  minute: ['1 分钟（{seconds} 秒）', '1 minute ({seconds} seconds)'],
  seconds: ['{seconds} 秒', '{seconds} seconds'],
  reset: ['{label}重置：{value}', '{label} resets: {value}'],
  fiveHourQuota: ['5 小时额度', '5-hour quota'], weeklyQuota: ['周额度', 'Weekly quota'],
  quotaBoth: ['5 小时 {five} · 周 {weekly}', '5h {five} · Week {weekly}'],
  quotaWeekly: ['周 {weekly}', 'Week {weekly}'],
  unknownWeek: ['接口没有返回明确的周窗口；— 表示未知，不能视为 100%。', 'The API did not return a weekly window; — means unknown, not 100%.'],
  waiting: ['等待刷新', 'Waiting to refresh'], querying: ['查询中', 'Querying'],
  failed: ['查询失败', 'Query failed'], signedOut: ['未登录', 'Signed out'],
  noSubscription: ['无订阅额度', 'No subscription quota'],
  trustRequired: ['请先信任工作区', 'Trust the workspace first'],
  localHostRequired: ['主插件需在本地运行', 'Main extension must run locally'],
  remoteDisconnected: ['未连接远程环境', 'No remote connection'],
  upgradeLocal: ['请在本地端安装新版 Codex Quota 主插件并完成首次升级。', 'Install the updated Codex Quota main extension locally and complete the initial upgrade.'],
  connectRemote: ['请连接远程工作区；插件会自动准备包内的远程查询支持。', 'Connect to a remote workspace; the extension will prepare its bundled remote support automatically.'],
  trustToQuery: ['信任工作区后可查询额度。', 'Quota queries are available after trusting the workspace.'],
  cleared: ['旧额度已清除；可点击状态栏重试或查看设置。', 'Previous quota has been cleared; click the status bar to retry or open settings.'],
  queryFailure: ['Codex 额度查询失败：{message}', 'Codex quota query failed: {message}'],
  diagnostics: ['查看诊断', 'View diagnostics'],
  settingsFailed: ['Codex Quota 无法完成操作；请查看诊断日志中的错误类别。', 'Codex Quota could not complete the action; check the error category in diagnostics.'],
  settingsInvalid: ['VS Code 设置文件含 JSON 语法错误；请修复后保存。', 'The VS Code settings file contains JSON errors; fix and save it.'],
  settingsUnsaved: ['VS Code 设置文件有未保存的修改；请先保存或撤销修改。', 'The VS Code settings file has unsaved changes; save or revert them first.'],
  settingsReadOnly: ['VS Code 设置或插件存储不可写；请检查只读状态和文件权限。', 'VS Code settings or extension storage are not writable; check read-only status and permissions.'],
  settingsManaged: ['此 VS Code 设置由策略管理。', 'This VS Code setting is managed by policy.'],
  settingsWriteFailed: ['VS Code 未能写入设置或插件偏好。', 'VS Code could not write the settings or extension preference.'],
  languageSavedLocally: ['语言已切换并保存为插件偏好；VS Code 设置未能写入，详情可查看诊断日志。', 'Language changed and saved as an extension preference; VS Code settings could not be written. See diagnostics for details.'],
  languageSessionOnly: ['语言已在当前窗口切换，但设置和插件存储均无法保存；关闭窗口后不会保留。详情可查看诊断日志。', 'Language changed in this window, but neither settings nor extension storage could save it; it will not persist after closing the window. See diagnostics for details.'],
  languagePreferenceCleanupFailed: ['语言已切换，但旧插件语言偏好未能清除；可检查插件存储权限。', 'Language changed, but an old extension preference could not be removed; check extension storage permissions.'],
  selectEnvironment: ['选择 Codex 额度查询环境', 'Choose the Codex quota query environment'],
  currentEnvironment: ['当前查询环境：{value}', 'Current query environment: {value}'],
  localDescription: ['本机 Codex CLI 和登录账号', 'Codex CLI and signed-in account on this machine'],
  remoteDescription: ['远程宿主的 Codex CLI 和账号；首次使用自动安装包内查询支持', 'Remote host’s Codex CLI and account; bundled query support installs automatically on first use'],
  remoteWarning: ['请先连接 VS Code 远程工作区；首次远程查询会自动安装包内的查询支持。', 'Connect to a VS Code remote workspace first; bundled query support installs automatically on first use.'],
  source: ['账号来源：该执行环境的 Codex CLI 当前登录状态（account/read），不是 VS Code 的 GitHub 账号。', 'Account source: the Codex CLI signed-in account in the selected environment (account/read), separate from the VS Code GitHub account.'],
  cli: ['CLI：{value}', 'CLI: {value}'], home: ['Codex 配置目录：{value}', 'Codex configuration directory: {value}'],
  credentials: ['凭据由 Codex 管理（配置目录或系统凭据存储）；插件不读取 auth.json。', 'Codex manages credentials in its configuration directory or system credential store; this extension does not read auth.json.'],
  menuRefresh: ['刷新额度', 'Refresh quota'], menuAccount: ['查看账号与额度来源', 'View account and quota source'],
  menuDiagnostics: ['查看诊断日志', 'View diagnostic log'], menuEnvironment: ['选择本地／远程环境', 'Choose local / remote environment'],
  menuPosition: ['切换状态栏左右位置', 'Switch status bar side'], menuSettings: ['打开设置', 'Open settings'],
  menuLanguage: ['选择显示语言', 'Choose display language'],
  autoLanguage: ['跟随 VS Code', 'Follow VS Code'],
  languageDescription: ['菜单、状态栏、悬浮提示和错误信息立即切换', 'Immediately update menus, status bar, tooltips and errors'],
  currentLanguage: ['当前显示语言：{value}', 'Current display language: {value}'],
  emailMissing: ['接口未提供邮箱', 'Email not provided'],
  chatgptAccount: ['{email}（ChatGPT / {plan}）', '{email} (ChatGPT / {plan})'],
  apiKeyAccount: ['API Key（不提供 ChatGPT 订阅额度）', 'API Key (no ChatGPT subscription quota)'],
  bedrockAccount: ['Amazon Bedrock（不提供 ChatGPT 订阅额度）', 'Amazon Bedrock (no ChatGPT subscription quota)'],
  signedOutAccount: ['未登录 ChatGPT；请在所选环境运行 codex login', 'Not signed in to ChatGPT; run codex login in the selected environment'],
  accountFormat: ['账号响应格式不兼容，请更新 Codex CLI。', 'The account response format is incompatible; update Codex CLI.'],
  invalidAccount: ['Codex 返回了无效的账号信息。', 'Codex returned invalid account information.'],
  unsupportedAccount: ['当前 Codex 账号类型尚不支持。', 'This Codex account type is not supported yet.'],
  invalidQuota: ['Codex 返回了无效的额度信息。', 'Codex returned invalid quota information.'],
  missingQuota: ['Codex 未返回额度快照。', 'Codex did not return a quota snapshot.'],
  otherModel: ['接口只返回了其他模型额度，未返回通用 Codex 额度。', 'The API returned only another model’s quota, without general Codex quota.'],
  windowFormat: ['额度窗口格式不兼容。', 'The quota window format is incompatible.'],
  invalidPercent: ['额度使用百分比无效。', 'The quota usage percentage is invalid.'],
  duplicateWindow: ['接口返回了重复的额度窗口。', 'The API returned duplicate quota windows.'],
  dllMissing: ['Windows 缺少 CLI 所需的 DLL；请修复 Codex 安装及运行库。', 'A DLL required by the CLI is missing on Windows; repair Codex and its runtime libraries.'],
  wrongArchitecture: ['Windows 无法加载此架构的可执行文件；请确认 CLI 与系统架构一致。', 'Windows cannot load this executable architecture; check that Codex CLI matches your system architecture.'],
  runtimeFailure: ['Windows 无法初始化 CLI；请检查运行库或系统拦截记录。', 'Windows could not initialize the CLI; check runtime libraries and system blocking logs.'],
  invalidHomeHint: ['CLI 报告 Codex 配置目录无效；请检查所选环境的配置目录设置或 CODEX_HOME。', 'The CLI reported an invalid Codex configuration directory; check the selected environment’s home setting or CODEX_HOME.'],
  argumentsHint: ['CLI 不支持启动参数；请检查 Codex 安装版本。', 'The CLI does not support the startup arguments; check the installed Codex version.'],
  databaseHint: ['CLI 报告状态数据库错误；请检查 Codex 数据目录权限或数据库占用。', 'The CLI reported a state database error; check directory permissions and database locks.'],
  permissionHint: ['CLI 报告文件权限错误；请检查 Codex 配置及数据目录是否可写。', 'The CLI reported a file permission error; check that its configuration and data directories are writable.'],
  configHint: ['CLI 报告配置解析或加载错误；请检查所选环境的 Codex 配置。', 'The CLI reported a configuration loading or parsing error; check Codex configuration in the selected environment.'],
  authHint: ['CLI 报告认证或凭据存储错误；请在同一环境检查 codex login status。', 'The CLI reported an authentication or credential store error; check codex login status in the same environment.'],
  networkHint: ['CLI 报告网络或代理错误；请检查同一环境中的网络配置。', 'The CLI reported a network or proxy error; check network configuration in the same environment.'],
  exitHint: ['请查看诊断日志中的 CLI 路径与失败阶段，并在同一环境检查 codex app-server。', 'Check the CLI path and failure phase in the diagnostic log, then try codex app-server in the same environment.'],
  processExit: ['Codex app-server 在{phase}阶段提前退出（退出码 {status}{signal}）。{hint}', 'Codex app-server exited early during {phase} (exit code {status}{signal}). {hint}'],
  signal: ['，信号 {value}', ', signal {value}'],
  unsupportedArchitecture: ['当前 Windows 架构不受 Codex CLI 支持。请设置原生 codex.exe 路径。', 'Codex CLI does not support this Windows architecture; set the native codex.exe path.'],
  nativeMissing: ['官方 Codex npm 包缺少 Windows 原生程序。请重新安装 @openai/codex，或将 cliPath 设为 codex.exe 的绝对路径。', 'The official Codex npm package is missing its native Windows executable. Reinstall @openai/codex or set the CLI path to an absolute codex.exe path.'],
  cliRequired: ['请设置 Codex CLI 路径。', 'Set the Codex CLI path.'],
  absoluteCli: ['CLI 路径必须为绝对路径或 PATH 中的命令名。', 'The CLI path must be absolute or a command name in PATH.'],
  cliMissing: ['找不到 Codex CLI。请在所选环境安装 Codex，并检查该环境的 CLI 路径设置。', 'Codex CLI was not found. Install Codex in the selected environment and check its CLI path setting.'],
  noShell: ['不执行 shell 包装脚本。请将 cliPath 设为 codex.exe 或官方 npm 包的 bin/codex.js。', 'Shell wrappers are not executed. Set the CLI path to codex.exe or the official npm package’s bin/codex.js.'],
  spawnFailure: ['无法启动 Codex CLI（{code}）；请检查可执行文件和权限。', 'Could not start Codex CLI ({code}); check the executable and permissions.'],
  unknownSystemError: ['未知系统错误', 'Unknown system error'],
  cancelled: ['额度查询已取消。', 'Quota query cancelled.'], finished: ['查询已结束。', 'Query finished.'],
  protocolSize: ['Codex 协议输出超过安全大小限制。', 'Codex protocol output exceeded the safe size limit.'],
  nonJson: ['Codex app-server 返回了非 JSON 协议数据。', 'Codex app-server returned non-JSON protocol data.'],
  unsupportedApi: ['当前 Codex CLI 不支持账号额度接口，请升级 Codex CLI。', 'This Codex CLI does not support the account quota API; upgrade Codex CLI.'],
  rpcFailure: ['Codex {method} 查询失败（错误码 {code}）。请检查登录状态、网络及 CLI 配置。', 'Codex {method} failed (error code {code}). Check login status, network and CLI configuration.'],
  missingResult: ['Codex 响应缺少 result 字段。', 'The Codex response is missing its result field.'],
  timeout: ['Codex {phase}超时（{seconds} 秒）。请检查 CLI 登录状态、配置目录写权限及网络，或增加 codexQuota.requestTimeoutSeconds。', 'Codex timed out during {phase} ({seconds} seconds). Check CLI login, directory permissions and network, or increase codexQuota.requestTimeoutSeconds.'],
  absoluteHome: ['codexHome 必须是绝对路径或 ~/ 路径。', 'The Codex home setting must be an absolute path or start with ~/.'],
  accountChanged: ['查询期间账号发生变化，请重新刷新。', 'The account changed during the query; refresh again.'],
  queryFailed: ['额度查询失败。', 'Quota query failed.'],
  phaseFind: ['查找 CLI', 'CLI lookup'], phaseInitialize: ['启动并初始化 CLI', 'CLI startup and initialization'],
  phaseAccount: ['读取账号', 'account read'], phaseQuota: ['读取额度', 'quota read'], phaseConfirm: ['确认账号', 'account verification'],
  remoteTimeout: ['远程额度查询超时；请检查远程连接和 Codex Quota Remote 查询组件。', 'The remote quota query timed out; check the connection and Codex Quota Remote component.'],
  remoteUnavailable: ['远程查询组件未安装、未启用或版本不兼容；插件将尝试准备包内的远程支持。', 'The remote component is missing, disabled or incompatible; the extension will try to prepare its bundled remote support.'],
  remoteWrongHost: ['查询组件未在当前远程宿主运行；请在远程端安装 Codex Quota Remote。', 'The query component is not running on the current remote host; install Codex Quota Remote there.'],
  remoteInvalidData: ['远程查询组件返回的数据无效。', 'The remote query component returned invalid data.'],
  remoteConnection: ['无法连接远程查询组件；请检查远程连接和扩展启用状态。', 'Could not connect to the remote query component; check the remote connection and extension enabled state.'],
  remoteTrust: ['远程查询组件需要在受信任的工作区宿主运行。', 'The remote query component must run in a trusted workspace host.'],
  remoteProtocol: ['远程查询协议版本不兼容；请安装相同版本的主插件和远程查询组件。', 'The remote query protocol is incompatible; install matching versions of the main and remote extensions.'],
  remoteRequest: ['远程查询请求无效。', 'The remote query request is invalid.'],
  preparingRemote: ['正在准备远程查询', 'Preparing remote queries'],
  remoteInstallFailed: ['无法安装包内的远程查询组件；请检查远程连接及扩展安装权限后重试。', 'Could not install the bundled remote component; check the remote connection and extension installation permissions, then retry.'],
  remoteInstallTimeout: ['远程组件安装等待超时；安装可能仍在后台进行，可稍后手动刷新。', 'Timed out waiting for the remote component; installation may still be running in the background. Refresh again later.'],
  remoteNotReady: ['远程查询组件尚未启用或协议不兼容；请检查远程端的扩展启用状态，稍后刷新。', 'The remote component is not enabled or its protocol is incompatible; check its enabled state on the remote host and refresh later.']
} as const;

export type MessageKey = keyof typeof messages;
export interface Message { key: MessageKey; values?: Record<string, string | number | Message> }
export const message = (key: MessageKey, values?: Message['values']): Message => ({ key, ...(values ? { values } : {}) });

export function resolveLanguage(setting: unknown, vscodeLanguage?: string): Language {
  if (setting === 'zh-CN' || setting === 'en') return setting;
  return vscodeLanguage?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function text(language: Language, value: Message): string {
  return messages[value.key][language === 'zh-CN' ? 0 : 1].replace(/\{(\w+)\}/g, (_, name: string) => {
    const parameter = value.values?.[name];
    return typeof parameter === 'object' ? text(language, parameter) : String(parameter ?? '');
  });
}

export function t(language: Language, key: MessageKey, values?: Message['values']): string {
  return text(language, message(key, values));
}

export class LocalizedError extends Error {
  constructor(readonly translation: Message) { super(text('zh-CN', translation)); }
}

export const errorMessage = (error: unknown): Message => error instanceof LocalizedError ? error.translation : message('queryFailed');
export const fail = (key: MessageKey, values?: Message['values']): LocalizedError => new LocalizedError(message(key, values));
