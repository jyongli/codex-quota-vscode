export type Language = 'zh-CN' | 'en';
export type LanguageSetting = 'auto' | Language;

const messages = {
  local: ['本地', 'Local'], remote: ['远程', 'Remote'], unknown: ['未知', 'Unknown'],
  notAvailable: ['未获取到', 'Unavailable'], notProvided: ['接口未提供', 'Not provided by the API'],
  title: ['Codex 剩余额度', 'Codex quota remaining'],
  ip: ['IP 地址：{value}', 'IP address: {value}'],
  publicIp: ['公网 IP：{value}', 'Public IP: {value}'],
  chooseSource: ['选择查询来源／环境', 'Choose quota source / environment'],
  activeSource: ['查询来源：{value}', 'Quota source: {value}'],
  ideLabel: ['VS Code Codex（配置账号）', 'VS Code Codex (configuration account)'],
  currentSource: ['当前选择', 'Selected'],
  inheritedHome: ['继承该宿主的 CODEX_HOME 或 ~/.codex', 'Inherited CODEX_HOME or ~/.codex on this host'],
  sourceChoiceHint: ['选择此宿主的账号来源；选择后读取登录账号与额度。', 'Choose an account source on this host; its signed-in account and quota are read after selection.'],
  selectionNotSaved: ['查询来源已切换，但偏好无法保存；下次打开需重新选择。', 'Source changed, but the preference could not be saved; choose again next time.'],
  ideSource: ['账号来源：官方 Codex VS Code 插件在此宿主共享的 Codex 配置目录，通过官方 app-server 读取配置账号；不读取插件内存中的登录状态。', 'Account source: the Codex configuration directory shared by the official Codex VS Code extension on this host, queried through its app-server. In-memory IDE sign-in is not read.'],
  sharedQuota: ['同一账号的 CLI 和 IDE 额度共享，分别显示不代表两个独立额度池。', 'CLI and IDE share quota for the same account; separate sources do not mean separate quota pools.'],
  sourceLimits: ['仅查询此插件宿主可访问的配置账号；官方插件的其他 SSH 连接、其他宿主及 Windows 内的 WSL 登录状态不在自动查询范围。', 'Only configuration accounts accessible to this extension host are queried. Other IDE SSH connections, other hosts and WSL sign-in from a Windows host are outside automatic discovery.'],
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
  installingCli: ['正在安装 Codex CLI', 'Installing Codex CLI'],
  cliInstalled: ['Codex CLI 已安装，开始查询。', 'Codex CLI installed; starting the query.'],
  loginHint: ['请在插件所在机器的终端运行 npx @openai/codex login；自定义 codexHome 时须使用同一配置目录。', 'Run npx @openai/codex login in the extension host terminal; use the same configuration directory if codexHome is customized.'],
  npmMissing: ['找不到 npm。请在插件所在机器安装 Node.js 与 npm，重新启动 VS Code 后刷新额度。', 'npm was not found. Install Node.js and npm in the extension host, restart VS Code, then refresh quota.'],
  npmStartFailed: ['无法在后台启动 npm；请检查该机器的 Node.js/npm 安装和权限。', 'Could not start npm in the background; check Node.js/npm installation and permissions on this host.'],
  installPermission: ['请检查插件存储目录写权限。', 'Check write permissions for the extension storage directory.'],
  installNetwork: ['请检查访问 registry.npmjs.org 的网络、代理和证书配置。', 'Check network, proxy and certificate configuration for registry.npmjs.org.'],
  installPlatform: ['当前操作系统或架构没有可用的官方 Codex CLI 包。', 'No official Codex CLI package is available for this operating system or architecture.'],
  installRetry: ['请检查该机器的 npm 配置，随后点击刷新重试。', 'Check npm configuration on this host, then refresh to retry.'],
  installFailed: ['Codex CLI 自动安装失败（npm 退出码 {code}）。{hint}', 'Automatic Codex CLI installation failed (npm exit code {code}). {hint}'],
  installTimeout: ['Codex CLI 自动安装超时（180 秒）；请检查网络后刷新重试。', 'Automatic Codex CLI installation timed out (180 seconds); check the network and refresh to retry.'],
  installIncomplete: ['npm 未安装完整的官方 Codex CLI；请检查系统架构和可选依赖后刷新重试。', 'npm did not install a complete official Codex CLI; check the system architecture and optional dependencies, then refresh to retry.'],
  installStorage: ['Codex CLI 自动安装无法写入插件存储；请检查磁盘空间和目录权限后刷新重试。', 'Automatic Codex CLI installation could not write extension storage; check disk space and directory permissions, then refresh to retry.'],
  failed: ['查询失败', 'Query failed'], signedOut: ['未登录', 'Signed out'],
  noSubscription: ['无订阅额度', 'No subscription quota'],
  trustRequired: ['请先信任工作区', 'Trust the workspace first'],
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
  queryHost: ['查询宿主：{value}（插件安装环境）', 'Query host: {value} (extension installation environment)'],
  source: ['账号来源：该执行环境的 Codex CLI 当前登录状态（account/read），不是 VS Code 的 GitHub 账号。', 'Account source: the Codex CLI signed-in account in the extension host (account/read), separate from the VS Code GitHub account.'],
  cli: ['CLI：{value}', 'CLI: {value}'], home: ['Codex 配置目录：{value}', 'Codex configuration directory: {value}'],
  credentials: ['凭据由 Codex 管理（配置目录或系统凭据存储）；插件不读取 auth.json。', 'Codex manages credentials in its configuration directory or system credential store; this extension does not read auth.json.'],
  menuRefresh: ['刷新额度', 'Refresh quota'], menuAccount: ['查看账号与额度来源', 'View account and quota source'],
  menuDiagnostics: ['查看诊断日志', 'View diagnostic log'],
  menuSettings: ['打开设置', 'Open settings'],
  emailMissing: ['接口未提供邮箱', 'Email not provided'],
  chatgptAccount: ['{email}（ChatGPT / {plan}）', '{email} (ChatGPT / {plan})'],
  apiKeyAccount: ['API Key（不提供 ChatGPT 订阅额度）', 'API Key (no ChatGPT subscription quota)'],
  bedrockAccount: ['Amazon Bedrock（不提供 ChatGPT 订阅额度）', 'Amazon Bedrock (no ChatGPT subscription quota)'],
  signedOutAccount: ['未登录 ChatGPT', 'Not signed in to ChatGPT'],
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
  invalidHomeHint: ['CLI 报告 Codex 配置目录无效；请检查插件运行环境的配置目录设置或 CODEX_HOME。', 'The CLI reported an invalid Codex configuration directory; check the extension host’s home setting or CODEX_HOME.'],
  argumentsHint: ['CLI 不支持启动参数；请检查 Codex 安装版本。', 'The CLI does not support the startup arguments; check the installed Codex version.'],
  databaseHint: ['CLI 报告状态数据库错误；请检查 Codex 数据目录权限或数据库占用。', 'The CLI reported a state database error; check directory permissions and database locks.'],
  permissionHint: ['CLI 报告文件权限错误；请检查 Codex 配置及数据目录是否可写。', 'The CLI reported a file permission error; check that its configuration and data directories are writable.'],
  configHint: ['CLI 报告配置解析或加载错误；请检查插件运行环境的 Codex 配置。', 'The CLI reported a configuration loading or parsing error; check Codex configuration in the extension host.'],
  authHint: ['CLI 报告认证或凭据存储错误；请在同一环境检查 codex login status。', 'The CLI reported an authentication or credential store error; check codex login status in the same environment.'],
  networkHint: ['CLI 报告网络或代理错误；请检查同一环境中的网络配置。', 'The CLI reported a network or proxy error; check network configuration in the same environment.'],
  exitHint: ['请查看诊断日志中的 CLI 路径与失败阶段，并在同一环境检查 codex app-server。', 'Check the CLI path and failure phase in the diagnostic log, then try codex app-server in the same environment.'],
  processExit: ['Codex app-server 在{phase}阶段提前退出（退出码 {status}{signal}）。{hint}', 'Codex app-server exited early during {phase} (exit code {status}{signal}). {hint}'],
  signal: ['，信号 {value}', ', signal {value}'],
  unsupportedArchitecture: ['当前 Windows 架构不受 Codex CLI 支持。请设置原生 codex.exe 路径。', 'Codex CLI does not support this Windows architecture; set the native codex.exe path.'],
  nativeMissing: ['官方 Codex npm 包缺少 Windows 原生程序。请重新安装 @openai/codex，或将 cliPath 设为 codex.exe 的绝对路径。', 'The official Codex npm package is missing its native Windows executable. Reinstall @openai/codex or set the CLI path to an absolute codex.exe path.'],
  cliRequired: ['请设置 Codex CLI 路径。', 'Set the Codex CLI path.'],
  absoluteCli: ['CLI 路径必须为绝对路径或 PATH 中的命令名。', 'The CLI path must be absolute or a command name in PATH.'],
  cliMissing: ['找不到 Codex CLI。请在插件运行环境安装 Codex，并检查该环境的 CLI 路径设置。', 'Codex CLI was not found. Install Codex in the extension host and check its CLI path setting.'],
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
