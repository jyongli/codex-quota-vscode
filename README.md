# Codex Quota for VS Code

中文 | [English](README.en.md)

Codex Quota 是一个 **Visual Studio Code（VS Code）插件**，用于在 VS Code 状态栏查看插件实际运行环境中 **Codex CLI 当前 ChatGPT 账号**的剩余额度。

- 有明确的 5 小时窗口：`Codex [本地] 5 小时 75% · 周 60%`。
- 没有 5 小时窗口：`Codex [本地] 周 60%`。
- 同一个 VSIX 可安装在本地或 SSH／WSL／容器端，读取插件实际运行机器的 CLI、账号和额度。
- 查询机器由安装位置决定；自动检测实际配置目录与登录账号，相同来源合并，只有一个时直接显示，多个时首次弹出选择；语言与左右位置在设置中配置。
- 支持跟随 VS Code、中文与 English，切换语言立即生效，无须重新查询或重载窗口。
- 悬浮提示显示执行宿主的内网 IP 与公网出口 IP、账号邮箱与计划、剩余额度、重置时间、查询时间和当前刷新时间间隔。
- 账号来源、CLI 路径与 Codex 配置目录通过“查看账号与额度来源”菜单查看。
- 默认每 5 分钟刷新，也可点击状态栏打开菜单手动刷新。

## 安装与使用

要求桌面 VS Code 1.95+。插件优先使用所在机器已有的官方 [Codex CLI](https://github.com/openai/codex)（建议 0.116.0+）；默认 `codex` 命令缺失时自动安装。自动安装需要该机器的 npm 和网络。

从 [GitHub Releases](https://github.com/jyongli/codex-quota-vscode/releases) 下载 **0.1.17**，只需一个安装包：

- [Codex Quota 安装包 codex-quota-monitor-ujyong-0.1.17.vsix](https://github.com/jyongli/codex-quota-vscode/releases/download/v0.1.17/codex-quota-monitor-ujyong-0.1.17.vsix)
- [安装包 SHA256](https://github.com/jyongli/codex-quota-vscode/releases/download/v0.1.17/codex-quota-monitor-ujyong-0.1.17.vsix.sha256)

本地窗口在“本地”安装；连接 SSH／WSL／容器后，在对应远程分组安装 **同一个 Codex Quota 插件、同一个 VSIX**。两端使用同一扩展 ID `ujyong.codex-quota-monitor-ujyong`，各自读取所在机器上已登录的 Codex CLI。

从 VS Code 扩展视图的“…”菜单选择 **Install from VSIX / 从 VSIX 安装**。本地安装也可执行：

```sh
code --install-extension codex-quota-monitor-ujyong-0.1.17.vsix
```

本版 Marketplace 发布者为 **`ujyong`**，扩展名称为 **`codex-quota-monitor-ujyong`**；原名称 `codex-quota-vscode` 在商店已被占用。如果安装过旧 ID **`jyongli.codex-quota-vscode`** 或 **`ujyong.codex-quota-vscode`**，请先在本地与对应远程端卸载旧插件，再安装新版；VS Code 将不同 ID 视为独立扩展，不能原地更新，同时启用会产生重复状态栏。现有 `codexQuota.*` 设置及 Codex CLI 登录继续使用，无须重新登录。

插件在 VS Code 选定的工作区宿主执行。CLI 不在该宿主的 PATH 中时，在本地用户设置或远程用户设置中指定 `codexQuota.cliPath` 的绝对路径；图形界面启动的 VS Code 不一定继承终端的 PATH。

点击状态栏打开菜单，或使用命令面板中的以下命令：

| 命令 | 功能 |
| --- | --- |
| Codex Quota: 刷新额度 | 立即查询，重叠请求合并 |
| Codex Quota: 查看账号与额度来源 | 查询后展示来源详情 |
| Codex Quota: 查看诊断日志 | 打开 Codex Quota 输出面板，查看失败阶段、CLI 路径、配置目录与退出码 |

## 查询来源与多个环境

先通过官方 `initialize`／`account/read` 检测各来源的实际 `.codex` 目录与登录账号，不读取认证文件，也不在选择前查询额度。只有**实际目录和账号同时一致**才合并；账号比较使用接口返回的邮箱与计划，两端均未登录时也可合并。继承 `CODEX_HOME`、显式路径和符号链接统一解析实际目录，Windows 路径比较忽略大小写。账号无法确认或 API Key／Bedrock 无法区分身份时保留独立来源。

合并后只有一个来源时直接显示；仍有多个来源时保留上次有效选择，没有保存过选择则首次自动弹出“选择查询来源／环境”，显示检测到的实际目录和账号。取消后保持原状态，自动刷新不重复弹窗；可从状态栏菜单再次选择。切换取消旧查询并清除旧数字，无需重载或修改设置。旧 CLI／IDE 来源选择在合并后仍兼容，只保存来源 ID；偏好存储只读不影响当次切换。

默认来源是当前宿主的 **CLI**。同一宿主安装了官方 `openai.chatgpt` 且能找到其原生／自定义 CLI 时，检测 **VS Code Codex（配置账号）**：使用官方插件的 CLI 和该宿主的 `CODEX_HOME`／`~/.codex` 查询共享配置账号，不套用为 CLI 单独指定的 `codexQuota.codexHome`。与 CLI 的实际目录及账号一致时自动合并为 **CLI / VS Code Codex**；有差异时提供独立选择，选择后读取剩余额度。“查看账号与额度来源”显示实际路径与合并依据。

**同一账号的 CLI 与 IDE 额度共享**，分开来源不代表两个额度池。IDE 来源代表共享配置目录中的账号，无法保证等于官方插件内存中的会话账号或它内部另一个 SSH 连接的账号；目前没有确认可供其他扩展调用的独立账号／额度 API。

此宿主有多个 Codex 配置账号时，可在本地／远程用户设置中配置：

```json
{
  "codexQuota.environments": [
    { "name": "工作账号", "codexHome": "~/codex-work" },
    { "name": "个人账号", "codexHome": "~/codex-personal", "cliPath": "/absolute/path/to/codex" }
  ]
}
```

名称须唯一；目录属于**插件实际运行机器**，使用绝对路径或 `~/`。可选 CLI 路径留空时继承该机器的 CLI 设置；账号登录由 Codex 管理，配置中不填凭据。

自动发现只包含当前宿主可访问的来源，不扫描其他机器或读取登录文件。官方插件在其他宿主运行、在 Windows 内启用 WSL，或在插件内部连接其他 SSH 环境时，不把本机 CLI 账号标成那个环境的账号；相应宿主需安装本插件并在该宿主查询。此选择不会让同一个扩展实例同时运行在本地和远程。

## Codex CLI 自动安装

首次查询先检查当前插件宿主的 CLI 路径与 PATH。已有可用 CLI 直接复用，遇到失效包装器继续查找后续 PATH 项；默认 `codex` 命令缺失或其包装脚本无法解析时，先复用本机已自动安装的副本，没有副本才安装官方 `@openai/codex@latest`。备用副本沿用同一配置目录与账号，不执行原包装脚本、不覆盖原安装。本地安装只在本地检测／安装，远程安装只在远程机器检测／安装。自定义命令或绝对路径无效时提供路径错误，不自动替换。

安装使用该机器 PATH 中 npm 的 JavaScript 入口，在后台通过官方 `https://registry.npmjs.org` 下载到 VS Code 的插件全局存储目录。插件不执行 npm.cmd shell 包装、不弹出命令行窗口、不需要管理员权限、不修改系统 PATH，也不覆盖全局 CLI。禁用安装脚本并明确包含官方平台可选依赖；完成后校验包身份、入口与原生程序，再启用。重复刷新／多个窗口共用安装锁；未完成的目录不作为成功安装复用。

状态栏显示“正在安装 Codex CLI”。安装独立超时为 180 秒；失败显示 npm 缺失、网络／代理／证书、权限、残缺平台包等类别，可通过“刷新额度”重试。插件退出或设置改变会取消正在进行的安装。若该机器没有 npm，请安装 Node.js 与 npm，再启动 VS Code；插件不会自动安装 Node.js 或提升权限。设置 `codexQuota.autoInstallCli: false` 可停止自动下载，已安装的副本仍可复用。

安装程序与登录账号是两件事。自动安装沿用同一宿主的 `CODEX_HOME`／`codexQuota.codexHome` 和系统凭据存储，已有登录直接读取；未登录显示“未登录”，请在该机器的终端执行 `npx @openai/codex login`，完成后刷新。自定义配置目录时，请给登录命令设置同一个 `CODEX_HOME`。插件不读取或迁移认证文件、不代为登录；“查看账号与额度来源”显示实际使用的 CLI 和配置目录。

## 按安装位置查询

1. **本地窗口**：在本地安装 Codex Quota，读取本机的 Codex CLI、登录账号、配置目录和 IP。
2. **SSH／WSL／Dev Container／桌面 Codespaces 窗口**：在当前远程端安装同一个 Codex Quota，CLI 缺失时在那台机器自动安装，并在该机器登录 ChatGPT；读取远程机器的账号、额度和 IP。可在扩展视图中点击“安装到 SSH: …／WSL: …／容器”，或在远程窗口使用“从 VSIX 安装”。
3. 两端都安装时，**远程窗口使用远程端，本地窗口使用本地端**。一个窗口只有一个该扩展实例和一条额度状态栏，不同时查询两端。远程查询失败时不会改读本机账号。
4. 状态栏 `[本地]`／`[远程]` 和悬浮提示的 IP 表示实际查询机器；“查看账号与额度来源”还显示宿主类型、CLI 和配置目录。可通过 **Developer: Show Running Extensions** 核实插件位置。

插件声明 `extensionKind: ["workspace"]`，采用 VS Code 原生工作区扩展的安装与执行规则。远程窗口必须安装到当前远程端；只装在本地的副本不会在该远程窗口代查本机。插件不发出重载窗口要求，不自动重载或安装其他组件；初次安装／升级是否需要启用或重新加载扩展，由 VS Code 的原生安装流程决定。

从旧版升级：原来的“选择本地／远程环境”和 `codexQuota.executionEnvironment` 已移除，遗留环境选择不会影响查询。旧的 **Codex Quota Remote** 组件已不再需要，可在远程扩展列表中卸载。若曾手动设置 `remote.extensionKind` 覆盖本插件，请移除该项，让 VS Code 按新的安装位置运行；插件不会改写用户的宿主覆盖。`remoteCliPath`／`remoteCodexHome` 暂作远程端兼容设置，尚未配置新键时继续使用；新配置统一使用 `cliPath`／`codexHome`。

浏览器版 VS Code、纯虚拟工作区及不受信任的工作区不在支持范围内。

悬浮提示的 **IP 地址**取自插件实际执行宿主的网卡：本地窗口显示本机地址，远程窗口显示远程宿主地址。排除回环地址，优先 IPv4；多张网卡的地址去重后列出，仅有 IPv6 时显示 IPv6，没有可用地址时显示“未获取到”。另加一行 **公网 IP**：由实际查询宿主通过 HTTPS 请求 `https://api64.ipify.org` 获取出口 IPv4／IPv6，本地安装查询本机、远程安装查询远程机器。地址按宿主缓存在内存中 5 分钟；请求独立超时为 3 秒，失败显示“未获取到”，不影响额度查询，失败结果只缓存 30 秒。服务请求不包含账号、CLI 路径或凭据；显示的是该 HTTPS 请求使用的出口，可能受 VPN／代理配置影响。设置 `codexQuota.showPublicIp: false` 可隐藏该行并停止公网 IP 请求。**刷新时间间隔**与实际轮询使用同一设置，修改后立即更新，例如 `5 分钟（300 秒）` 或 `90 秒`。

## 语言与状态栏位置设置

点击状态栏 → **打开设置 / Open settings**，直接打开 Codex Quota 的设置页面。单一来源时菜单包含刷新额度、查看账号与额度来源、查看诊断日志和打开设置；多个来源时增加选择查询来源／环境。

- **Language / 显示语言**：跟随 VS Code（`auto`）、中文（`zh-CN`）、English（`en`）。自动模式对中文 VS Code 显示中文，其他界面语言显示英文。
- **Status Bar Position / 状态栏位置**：左侧（`left`）或右侧（`right`）。

也可在用户或工作区设置中填写：

```json
{
  "codexQuota.language": "zh-CN",
  "codexQuota.statusBarPosition": "right"
}
```

修改设置后立即更新菜单、状态栏、悬浮提示、账号说明和错误提示，保留当前额度与查询时间，不重新查询、不重载窗口。工作区设置优先于用户设置；已有工作区覆盖时，请修改对应工作区设置。

语言与位置统一以 VS Code 设置为准，旧语言菜单保存在插件存储中的偏好不再覆盖设置。设置的保存由 VS Code 原生设置界面管理；若设置文件不可写或含 JSON 错误，需先修复文件再保存。

命令面板标题、扩展说明及原生设置页面文案跟随 VS Code 界面语言；插件语言选项控制运行时显示。账号邮箱、IP、文件路径和计划名称保留接口原始值。

## 官方接口与账号来源

查询采用 OpenAI 公开的 **Codex app-server 账号／额度协议**，由插件所在机器的官方 CLI 执行 `codex app-server --listen stdio://`，通过 stdio JSONL 通信：

1. `initialize` → `initialized`，完成握手。
2. `account/read`（`refreshToken: false`），读取 CLI 的有效登录类型、邮箱与计划。
3. ChatGPT 登录时调用 `account/rateLimits/read`。
4. 再读一次账号，若查询期间账号改变则拒绝混合快照。

当前实现使用官方支持的 CLI 协议入口；没有依赖未经确认的公网 REST 额度接口，也没有抓取交互式 `/status` 的终端文字。

官方参考：

- [Codex app-server 文档（0.116.0）：账号与额度](https://github.com/openai/codex/blob/rust-v0.116.0/codex-rs/app-server/README.md)
- [官方额度协议类型](https://github.com/openai/codex/blob/rust-v0.116.0/codex-rs/app-server-protocol/src/protocol/v2.rs)
- [VS Code 远程扩展：执行位置与 extensionKind](https://code.visualstudio.com/api/advanced-topics/remote-extensions#incorrect-execution-location)

**账号来源**是插件所在机器的 Codex CLI 当前有效认证。两端配置目录都使用各自用户设置中的 `codexQuota.codexHome`；留空时继承相应宿主的 `CODEX_HOME`，默认 `~/.codex`；新版本以 `initialize` 返回的实际 `codexHome` 为准。凭据可能由 Codex 保存在此目录或系统凭据存储中。插件不读取 `auth.json`、不解码 JWT、不自行处理登录或发送 token。账号不是 VS Code 的 GitHub 登录，也不承诺与其他扩展显示的账号相同。

API Key、Amazon Bedrock 和未登录状态会分别标明，不伪造 ChatGPT 订阅额度。API Key 使用的 API 计费额度不等同于 ChatGPT Codex 的 5 小时／周额度。

辅助 app-server 沿用当前宿主的 CLI 的配置、SQLite 数据库与日志目录，不注入 `sqlite_home` / `log_dir` 覆盖参数。Codex 需要对其正常的数据／配置目录具有相应权限。Windows 官方 npm 入口解析为原生程序时保留官方包根目录环境变量；Electron 的 Node 模式仅用于 JavaScript 入口，不传给原生程序。

## 额度含义与异常处理

显示值为 `max(0, 100 - usedPercent)`，保留最多一位小数。按 `windowDurationMins` 识别 **300 分钟**及 **10080 分钟**，不假定 primary / secondary 的位置；多额度桶优先使用 `codex`，不混合其他模型的额度。

`—` 表示接口没有返回明确的对应窗口。未知时长不会被标成周额度；没有周窗口时不会假装剩余 100%。重置时间来自接口的 Unix 时间戳，以插件所选中／英文区域格式显示，不根据时间自行推断恢复额度。

请求超时、协议错误或网络失败后会清除旧数字并显示“查询失败”，同时主动弹出错误提示，可点击“查看诊断”。自动刷新遇到相同错误不会重复弹窗，手动刷新失败会再次提示。设置变化取消旧查询；插件卸载会终止辅助进程。查询只调用初始化、账号读取与额度读取，不创建会话，不发起模型生成。

CLI 用参数数组在后台启动，`shell: false`、`windowsHide: true`，通过管道通信，不打开终端窗口；路径不是 shell 命令，不能填写管道或额外参数。Windows 支持直接配置 `codex.exe`，也支持官方 npm 的 `codex.cmd` 和 `bin/codex.js` 入口。常见 `.cmd`／`.bat`／`.ps1` 包装器按其实际目标解析，支持独立 npm 前缀、pnpm／Yarn 全局目录，以及直接转发参数到原生 `codex.exe` 的入口；解析常用安装目录变量和 UTF-16 PowerShell 文件，不执行脚本内容或额外 shell 参数。官方 npm 入口解析为已安装的原生 `codex.exe` 后直接启动，避免 JS 包装器二次启动时弹出窗口；支持 x64／ARM64、平台依赖包与旧版内置 vendor 目录。缺少原生依赖时提示重新安装 CLI，不退回包装器。无法解析的显式路径会在诊断中指出命中的包装器。查询完成、取消或超时后结束辅助进程。

默认查询超时为 60 秒，保留用户已有设置。超时提示会指出发生在 CLI 查找／初始化、账号读取、额度读取或账号确认阶段。若仍显示“读取额度超时”，先在**插件所在机器**的终端确认 `codex --version` 和 ChatGPT 登录可用，并检查 CLI 到官方服务的网络；可把 `codexQuota.requestTimeoutSeconds` 设置为 120 后手动重试。增加超时不会修复登录或网络故障。

若 app-server 提前退出，提示会包含失败阶段、退出码／终止信号，并对已识别的配置目录、权限、数据库、认证、网络或 Windows 运行库错误给出分类说明。执行 **Codex Quota: 查看诊断日志**，或打开“输出”并选择 **Codex Quota**，可以查看错误和所用 CLI／配置目录。在终端手动执行 `codex app-server` 时没有输出是正常的：它等待客户端发送协议请求；单凭静默启动不能证明额度接口可用。

## 设置

| 设置 | 默认 | 说明 |
| --- | --- | --- |
| `codexQuota.environments` | `[]` | 此宿主的其他 CLI 配置账号；多个来源选择后查询 |
| `codexQuota.language` | `auto` | `auto` / `zh-CN` / `en`，即时切换显示语言 |
| `codexQuota.showPublicIp` | `true` | 显示查询宿主的公网出口 IP；关闭后停止请求 |
| `codexQuota.statusBarPosition` | `right` | `left` / `right`，即时生效 |
| `codexQuota.cliPath` | `codex` | 当前宿主的 CLI 路径；默认命令缺失时自动安装，自定义路径不替换 |
| `codexQuota.autoInstallCli` | `true` | CLI 缺失时在当前宿主的插件存储中自动安装官方 npm 包 |
| `codexQuota.codexHome` | 空 | 当前宿主的配置目录；继承该机器的配置，支持绝对路径和 `~/` |
| `codexQuota.refreshIntervalSeconds` | `300` | 自动刷新间隔，60–3600 秒 |
| `codexQuota.requestTimeoutSeconds` | `60` | 整个查询的超时，5–120 秒；错误标明失败阶段 |

CLI 路径和配置目录采用机器级（`machine`）范围，不接受工作区覆盖，也不通过 Settings Sync 同步。本地窗口在本地用户设置配置，远程窗口在远程用户设置配置；远程机器不继承本地机器级路径。新设置未配置时，远程端仍兼容旧 `remoteCliPath`／`remoteCodexHome`，本地端不会读取这些旧远程路径。工作区需要受到信任才能执行 CLI。插件不增加遥测、不上传账号信息；Codex 自身的网络和遥测遵循其官方配置。上游原始错误和 stderr 不写入插件 UI，避免意外暴露凭据。

## 开发、测试与打包

使用现有仓库，Node.js 20+：

```sh
npm ci
npm test
npm run test:bundle
npm run package
```

`npm test` 包含额度与账号解析、宿主选择、真实子进程协议往返、超时与取消、敏感错误过滤，以及模拟 VS Code API 的扩展行为测试。协议测试只使用独立虚构账号和临时目录，不使用真实凭据。`test:bundle` 对实际打包入口重跑扩展行为测试。

可选原生 CLI 冒烟测试（真实 CLI + 临时未登录配置，不触碰现有账号）：

```sh
npm run test:native -- /absolute/path/to/codex
```

真实 VS Code 宿主测试使用固定 VS Code 1.95.3；需要访问 `update.code.visualstudio.com` 与其官方下载域名（通常为 `vscode.download.prss.microsoft.com`），Linux 无图形界面时需要 Xvfb：

```sh
npm run test:vscode
# Linux CI:
xvfb-run -a npm run test:vscode
```

已有官方 VS Code 可执行文件时可使用 `CODEX_QUOTA_VSCODE_EXECUTABLE=/absolute/path/to/code npm run test:vscode`，不再重复下载。

该测试验证激活、额度状态、账号来源、工作区覆盖下的位置切换、API Key 状态、失败诊断，原生语言／位置设置即时生效、简化菜单打开设置，以及单个工作区扩展的实际运行位置和本机路径读取。设置 `CODEX_QUOTA_NATIVE_CLI` 为官方 CLI 入口路径可额外验证真实 VS Code 宿主启动 CLI 并读取临时未登录账号；CI 在 Windows 与 Linux 上均执行此检查。真实远程宿主验证仍需按上面的步骤在实际 SSH / WSL / 容器连接中安装该插件。按 F5 可启动扩展调试宿主。

公开打包结果只有 `artifacts/codex-quota-monitor-ujyong-<版本>.vsix`，同一个包可安装在本地和远程。安装包只包含运行入口、清单、说明与许可证；没有内置第二扩展或运行时 npm 依赖，不包含测试、开发依赖或凭据。打包命令只生成本地文件，不推送或发布。

发布到 GitHub 使用 `.github/workflows/release.yml`：仅推送 `v*` 标签或手动运行时执行发布，避免同时推送发布目录和标签产生重复任务。完成 Windows 与 Linux 测试、校验 `releases/<标签>` 中已验证的 VSIX 后，创建附带安装包与 SHA256 的 Release。手动运行根据 `package.json` 版本选择已有标签；已有 Release 不重复创建。该工作流需要仓库启用 GitHub Actions；写权限仅赋予发布任务。

本次验证的具体结果与实测范围见仓库开发文档 `TESTING.md`（不包含在 VSIX 内）。
