# Codex Quota for VS Code

中文 | [English](README.en.md)

Codex Quota 是一个 **Visual Studio Code（VS Code）插件**，用于在 VS Code 状态栏查看所选执行环境中 **Codex CLI 当前 ChatGPT 账号**的剩余额度。

- 有明确的 5 小时窗口：`Codex [本地] 5 小时 75% · 周 60%`。
- 没有 5 小时窗口：`Codex [本地] 周 60%`。
- 单个 VSIX 内置远程查询支持，首次远程查询自动准备，无须另行下载远程安装包。
- 本地／远程查询即时切换，无须重载窗口；状态栏左／右位置即时切换。
- 支持跟随 VS Code、中文与 English，切换语言立即生效，无须重新查询或重载窗口。
- 悬浮提示显示执行宿主的内网 IP 与公网出口 IP、账号邮箱与计划、剩余额度、重置时间、查询时间和当前刷新时间间隔。
- 账号来源、CLI 路径与 Codex 配置目录通过“查看账号与额度来源”菜单查看。
- 默认每 5 分钟刷新，也可点击状态栏打开菜单手动刷新。

## 安装与使用

要求桌面 VS Code 1.95+。在要查询的机器安装官方 [Codex CLI](https://github.com/openai/codex)，建议 0.116.0+，并用 ChatGPT 账号执行 `codex login`。

从 [GitHub Releases](https://github.com/jyongli/codex-quota-vscode/releases) 下载 **0.1.8**，只需一个安装包：

- [Codex Quota 安装包 codex-quota-vscode-0.1.8.vsix](https://github.com/jyongli/codex-quota-vscode/releases/download/v0.1.8/codex-quota-vscode-0.1.8.vsix)
- [安装包 SHA256](https://github.com/jyongli/codex-quota-vscode/releases/download/v0.1.8/codex-quota-vscode-0.1.8.vsix.sha256)

在本地安装这个 VSIX。连接远程工作区并选择“远程”后，插件会使用 VS Code 内置安装命令，把包内的远程查询组件安装到当前远程宿主，不需要再下载第二个 VSIX，也不依赖 Marketplace。已有协议兼容的远程组件会继续使用，避免打断正在运行的扩展。

从 VS Code 扩展视图的“…”菜单选择 **Install from VSIX / 从 VSIX 安装**。本地安装也可执行：

```sh
code --install-extension codex-quota-vscode-0.1.8.vsix
```

VS Code 商店的发布配置与操作见 [Marketplace 发布说明](MARKETPLACE.md)。发布流程使用已通过双平台检查的 GitHub Release 安装包。

插件默认在本地执行。CLI 不在 VS Code 进程的 PATH 中时，在用户设置中指定 `codexQuota.cliPath` 的绝对路径；图形界面启动的 VS Code 不一定继承终端的 PATH。

点击状态栏打开菜单，或使用命令面板中的以下命令：

| 命令 | 功能 |
| --- | --- |
| Codex Quota: 刷新额度 | 立即查询，重叠请求合并 |
| Codex Quota: 选择本地／远程环境 | 立即改为查询所选机器，无须重载 |
| Codex Quota: 切换状态栏左右位置 | 更新当前生效的用户／工作区设置并立即生效 |
| Codex Quota: 选择显示语言 | 跟随 VS Code／中文／English，立即更新当前显示 |
| Codex Quota: 查看账号与额度来源 | 查询后展示来源详情 |
| Codex Quota: 查看诊断日志 | 打开 Codex Quota 输出面板，查看失败阶段、CLI 路径、配置目录与退出码 |

## 本地／远程选择

同一个扩展 ID 在 VS Code 中只会选择一个执行宿主，安装在两端不会让两端同时运行。因此一个 VSIX 内包含两个内部运行部分：主插件固定在本地负责状态栏与本机查询，包内的 **Codex Quota Remote** 在远程宿主读取 CLI 与账号。用户只安装主 VSIX；远程部分由插件自动部署，扩展视图中仍可看到内部组件。两端通过 VS Code 命令通道传递查询结果和取消请求，切换环境只改变查询路由，无须迁移扩展宿主。支持 Remote SSH、WSL、Dev Containers 和桌面 Codespaces。

1. 本地查询使用本机的 Codex CLI、环境变量、配置目录和系统凭据存储。
2. 连接远程工作区，在远程机器安装和登录 Codex CLI。
3. 执行“选择本地／远程环境”，选择“远程”。已有兼容组件时直接查询；缺少或不兼容时显示“正在准备远程查询”，自动通过 VS Code 把包内 VSIX 安装到远程端，等待命令可用后重新查询，无须重载窗口。安装错误使用固定分类提示，原始错误不显示。
4. 通过状态栏的 `[本地]`／`[远程]` 和悬浮提示中的 IP 地址确认所查询的宿主；“查看账号与额度来源”展示账号来源与路径。远程端的 CLI 路径与配置目录分别使用 `codexQuota.remoteCliPath`、`codexQuota.remoteCodexHome`，通过 VS Code 的远程用户设置配置。

环境选择使用 `codexQuota.executionEnvironment` 设置，例如：

```json
{
  "codexQuota.executionEnvironment": "remote"
}
```

`local` 选择本地，`remote` 选择远程。菜单更新当前生效的设置层：已有工作区覆盖时更新工作区，否则更新用户设置。没有远程连接、组件缺失或组件装在错误宿主时会显示提示，不退回本机账号。可通过 **Developer: Show Running Extensions** 核实两个组件的运行位置。

从 0.1.3 及更早版本升级时，插件会把自己的旧 `remote.extensionKind` 用户覆盖迁移为新环境设置，并保留其他扩展的配置。若旧版主插件已经运行在远程端，首次升级需要按 VS Code 提示重新加载扩展，以应用本地 UI 宿主；以后的环境切换不会触发重载窗口。插件不会自动重载当前窗口。

浏览器版 VS Code、纯虚拟工作区及不受信任的工作区不在支持范围内。

悬浮提示的 **IP 地址**取自插件实际执行宿主的网卡：本地模式显示本机地址，远程模式显示远程宿主地址。排除回环地址，优先 IPv4；多张网卡的地址去重后列出，仅有 IPv6 时显示 IPv6，没有可用地址时显示“未获取到”。另加一行 **公网 IP**：由实际查询宿主通过 HTTPS 请求 `https://api64.ipify.org` 获取出口 IPv4／IPv6，本地模式查询本机、远程模式查询远程机器。地址按宿主缓存在内存中 5 分钟；请求独立超时为 3 秒，失败显示“未获取到”，不影响额度查询，失败结果只缓存 30 秒。服务请求不包含账号、CLI 路径或凭据；显示的是该 HTTPS 请求使用的出口，可能受 VPN／代理配置影响。设置 `codexQuota.showPublicIp: false` 可隐藏该行并停止公网 IP 请求。**刷新时间间隔**与实际轮询使用同一设置，修改后立即更新，例如 `5 分钟（300 秒）` 或 `90 秒`。

## 中英文选择

点击状态栏 → **选择显示语言 / Choose display language**，可选择 **跟随 VS Code、中文、English**。也可设置 `codexQuota.language` 为 `auto`、`zh-CN` 或 `en`。自动模式对中文 VS Code 显示中文，其他界面语言显示英文。

插件菜单、状态栏、悬浮提示、账号说明及错误提示立即切换，保留当前额度和查询时间，不中断查询、不重载窗口。命令面板标题、扩展说明及原生设置页面文案使用 VS Code 的清单翻译机制，跟随 VS Code 界面语言；独立的插件语言选项控制插件运行时显示。账号邮箱、IP、文件路径和计划名称保留接口原始值。

语言菜单先更新当前生效的用户／工作区设置。设置文件含 JSON 错误、未保存修改或不可写时，语言仍立即切换，并保存到 VS Code 的插件存储；工作区选择保存在对应工作区。插件会给出信息提示，诊断日志记录固定的错误类别，不覆盖原设置文件。重新选择语言且设置保存成功，或手动修改语言设置后，清除此前的插件偏好。若设置和插件存储都不能写入，则仍切换当前窗口的语言，并明确提示关闭窗口后不会保留；额度不受影响。

## 官方接口与账号来源

查询采用 OpenAI 公开的 **Codex app-server 账号／额度协议**，由所选宿主的官方 CLI 执行 `codex app-server --listen stdio://`，通过 stdio JSONL 通信：

1. `initialize` → `initialized`，完成握手。
2. `account/read`（`refreshToken: false`），读取 CLI 的有效登录类型、邮箱与计划。
3. ChatGPT 登录时调用 `account/rateLimits/read`。
4. 再读一次账号，若查询期间账号改变则拒绝混合快照。

当前实现使用官方支持的 CLI 协议入口；没有依赖未经确认的公网 REST 额度接口，也没有抓取交互式 `/status` 的终端文字。

官方参考：

- [Codex app-server 文档（0.116.0）：账号与额度](https://github.com/openai/codex/blob/rust-v0.116.0/codex-rs/app-server/README.md)
- [官方额度协议类型](https://github.com/openai/codex/blob/rust-v0.116.0/codex-rs/app-server-protocol/src/protocol/v2.rs)
- [VS Code 远程扩展：执行位置与 extensionKind](https://code.visualstudio.com/api/advanced-topics/remote-extensions#incorrect-execution-location)

**账号来源**是所选宿主的 Codex CLI 当前有效认证。本地配置目录使用 `codexQuota.codexHome`，远程配置目录使用 `codexQuota.remoteCodexHome`；留空时继承相应宿主的 `CODEX_HOME`，默认 `~/.codex`；新版本以 `initialize` 返回的实际 `codexHome` 为准。凭据可能由 Codex 保存在此目录或系统凭据存储中。插件不读取 `auth.json`、不解码 JWT、不自行处理登录或发送 token。账号不是 VS Code 的 GitHub 登录，也不承诺与其他扩展显示的账号相同。

API Key、Amazon Bedrock 和未登录状态会分别标明，不伪造 ChatGPT 订阅额度。API Key 使用的 API 计费额度不等同于 ChatGPT Codex 的 5 小时／周额度。

辅助 app-server 沿用所选 CLI 的配置、SQLite 数据库与日志目录，不注入 `sqlite_home` / `log_dir` 覆盖参数。Codex 需要对其正常的数据／配置目录具有相应权限。Windows 官方 npm 入口解析为原生程序时保留官方包根目录环境变量；Electron 的 Node 模式仅用于 JavaScript 入口，不传给原生程序。

## 额度含义与异常处理

显示值为 `max(0, 100 - usedPercent)`，保留最多一位小数。按 `windowDurationMins` 识别 **300 分钟**及 **10080 分钟**，不假定 primary / secondary 的位置；多额度桶优先使用 `codex`，不混合其他模型的额度。

`—` 表示接口没有返回明确的对应窗口。未知时长不会被标成周额度；没有周窗口时不会假装剩余 100%。重置时间来自接口的 Unix 时间戳，以插件所选中／英文区域格式显示，不根据时间自行推断恢复额度。

请求超时、协议错误或网络失败后会清除旧数字并显示“查询失败”，同时主动弹出错误提示，可点击“查看诊断”。自动刷新遇到相同错误不会重复弹窗，手动刷新失败会再次提示。安装等待最多 60 秒，安装完成后等待命令注册最多 10 秒。安装期间切回本地会立即结束等待；VS Code 已开始的安装可以在后台完成，但不会继续发起已取消的远程查询。安装失败可手动刷新重试；不会自动重载窗口或强制启用用户禁用的组件。设置变化取消旧查询；插件卸载会终止辅助进程。查询只调用初始化、账号读取与额度读取，不创建会话，不发起模型生成。

CLI 用参数数组在后台启动，`shell: false`、`windowsHide: true`，通过管道通信，不打开终端窗口；路径不是 shell 命令，不能填写管道或额外参数。Windows 支持直接配置 `codex.exe`，也支持官方 npm 的 `codex.cmd` 和 `bin/codex.js` 入口。插件会将官方 npm 入口解析为已安装的原生 `codex.exe` 后直接启动，避免 JS 包装器二次启动时弹出窗口；支持 x64／ARM64、平台依赖包与旧版内置 vendor 目录。缺少原生依赖时提示重新安装 CLI，不退回包装器。查询完成、取消或超时后结束辅助进程。

默认查询超时为 60 秒，保留用户已有设置。超时提示会指出发生在 CLI 查找／初始化、账号读取、额度读取或账号确认阶段。若仍显示“读取额度超时”，先在**所选环境**的终端确认 `codex --version` 和 ChatGPT 登录可用，并检查 CLI 到官方服务的网络；可把 `codexQuota.requestTimeoutSeconds` 设置为 120 后手动重试。增加超时不会修复登录或网络故障。

若 app-server 提前退出，提示会包含失败阶段、退出码／终止信号，并对已识别的配置目录、权限、数据库、认证、网络或 Windows 运行库错误给出分类说明。执行 **Codex Quota: 查看诊断日志**，或打开“输出”并选择 **Codex Quota**，可以查看错误和所用 CLI／配置目录。在终端手动执行 `codex app-server` 时没有输出是正常的：它等待客户端发送协议请求；单凭静默启动不能证明额度接口可用。

## 设置

| 设置 | 默认 | 说明 |
| --- | --- | --- |
| `codexQuota.executionEnvironment` | `local` | `local` / `remote`，即时切换；首次远程查询自动安装包内支持 |
| `codexQuota.language` | `auto` | `auto` / `zh-CN` / `en`，即时切换显示语言 |
| `codexQuota.showPublicIp` | `true` | 显示查询宿主的公网出口 IP；关闭后停止请求 |
| `codexQuota.statusBarPosition` | `right` | `left` / `right`，即时生效 |
| `codexQuota.cliPath` | `codex` | 本机 CLI 路径；本地用户设置，远程设置不能覆盖 |
| `codexQuota.codexHome` | 空 | 本机配置目录；继承本机配置，支持绝对路径和 `~/` |
| `codexQuota.remoteCliPath` | `codex` | 远程 CLI 路径；在远程用户设置配置 |
| `codexQuota.remoteCodexHome` | 空 | 远程配置目录；继承远程配置，支持绝对路径和 `~/` |
| `codexQuota.refreshIntervalSeconds` | `300` | 自动刷新间隔，60–3600 秒 |
| `codexQuota.requestTimeoutSeconds` | `60` | 整个查询的超时，5–120 秒；错误标明失败阶段 |

本地 CLI 路径和配置目录采用 application 范围，只从本地用户设置读取；远程路径和目录采用独立的机器级设置，不接受工作区覆盖。VS Code 会向两个宿主提供合并后的配置，因此两端使用不同的设置键，避免读取另一端的路径。升级时如有旧的自定义远程路径，请将远程用户设置中的 `codexQuota.cliPath`、`codexQuota.codexHome` 改为 `codexQuota.remoteCliPath`、`codexQuota.remoteCodexHome`；本地原有设置保留。工作区需要受到信任才能执行 CLI。插件不增加遥测、不上传账号信息；Codex 自身的网络和遥测遵循其官方配置。上游原始错误和 stderr 不写入插件 UI，避免意外暴露凭据。

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

该测试验证激活、额度状态、账号来源、工作区覆盖下的位置切换、API Key 状态、失败诊断，以及主插件／查询组件通过 VS Code 命令通信。设置 `CODEX_QUOTA_NATIVE_CLI` 为官方 CLI 入口路径可额外验证真实 VS Code 宿主启动 CLI 并读取临时未登录账号；CI 在 Windows 与 Linux 上均执行此检查。真实远程宿主验证仍需按上面的步骤在实际 SSH / WSL / 容器连接中安装并切换。按 F5 可启动扩展调试宿主。

公开打包结果只有 `artifacts/codex-quota-vscode-<版本>.vsix`。构建先生成 `bundled/remote.vsix`，再把它嵌入主 VSIX；该内部安装包无须用户单独下载。主插件及 `remote-provider/package.json` 的版本必须一致。安装包只包含运行入口、清单、说明、许可证和内置远程组件；没有运行时 npm 依赖，不包含测试、开发依赖或凭据。打包命令只生成本地文件，不推送或发布。

发布到 GitHub 使用 `.github/workflows/release.yml`：推送 `v*` 标签，或在 `main` 更新发布目录／发布工作流后，完成 Windows 与 Linux 测试、校验 `releases/<标签>` 中已验证的 VSIX，并创建附带安装包与 SHA256 的 Release。主分支及手动运行根据 `package.json` 版本选择已有标签；已有 Release 不重复创建。该工作流需要仓库启用 GitHub Actions；写权限仅赋予发布任务。

本次验证的具体结果与实测范围见仓库开发文档 `TESTING.md`（不包含在 VSIX 内）。
