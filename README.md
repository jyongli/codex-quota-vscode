# Codex Quota for VS Code

在状态栏查看所选执行环境中 **Codex CLI 当前 ChatGPT 账号**的剩余额度。

- 有明确的 5 小时窗口：`Codex [本地] 5 小时 75% · 周 60%`。
- 没有 5 小时窗口：`Codex [本地] 周 60%`。
- 支持本地与远程执行环境选择，以及状态栏左／右位置即时切换。
- 悬浮提示显示账号邮箱、计划、实际执行环境、CLI 路径、Codex 配置目录、查询时间和额度重置时间。
- 默认每 5 分钟刷新，也可点击状态栏打开菜单手动刷新。

## 安装与使用

要求桌面 VS Code 1.95+。在要查询的机器安装官方 [Codex CLI](https://github.com/openai/codex)，建议 0.116.0+，并用 ChatGPT 账号执行 `codex login`。

从 [GitHub Releases](https://github.com/jyongli/codex-quota-vscode/releases) 下载 VSIX；已验证的 0.1.0 包也保存在 [releases/v0.1.0](releases/v0.1.0) 中，可用以下链接直接下载：

- [codex-quota-vscode-0.1.0.vsix](https://github.com/jyongli/codex-quota-vscode/raw/refs/heads/main/releases/v0.1.0/codex-quota-vscode-0.1.0.vsix)
- [SHA256 校验文件](https://github.com/jyongli/codex-quota-vscode/raw/refs/heads/main/releases/v0.1.0/codex-quota-vscode-0.1.0.vsix.sha256)

从 VS Code 扩展视图的“…”菜单选择 **Install from VSIX / 从 VSIX 安装**。本地安装也可执行：

```sh
code --install-extension codex-quota-vscode-0.1.0.vsix
```

插件默认在本地执行。CLI 不在 VS Code 进程的 PATH 中时，在用户设置中指定 `codexQuota.cliPath` 的绝对路径；图形界面启动的 VS Code 不一定继承终端的 PATH。

点击状态栏打开菜单，或使用命令面板中的以下命令：

| 命令 | 功能 |
| --- | --- |
| Codex Quota: 刷新额度 | 立即查询，重叠请求合并 |
| Codex Quota: 选择本地／远程环境 | 选择 CLI 和账号所在的执行宿主 |
| Codex Quota: 切换状态栏左右位置 | 即时切换，无需重载 |
| Codex Quota: 查看账号与额度来源 | 查询后展示来源详情 |

## 本地／远程选择

本地与远程是 VS Code 的 **实际扩展执行宿主**，不是两套登录输入框。支持 Remote SSH、WSL、Dev Containers 和桌面 Codespaces 等 Node 扩展宿主。

1. 本地查询使用本机的 Codex CLI、环境变量、配置目录和系统凭据存储。
2. 远程查询需要先连接远程工作区，在远程端安装**同一 VSIX**，并在那里安装和登录 Codex CLI。在扩展视图确认目标端已安装；从 VSIX 安装后确认安装位置。
3. 执行“选择本地／远程环境”，选择目标端，再按提示**重载窗口**。
4. 悬浮状态栏确认“实际执行环境”及账号来源。远程端的 CLI 路径与配置目录通过 VS Code 的远程用户设置配置。

环境选择使用 VS Code 官方 `remote.extensionKind` 设置，只更新 `jyongli.codex-quota-vscode` 这一项，并保留其他扩展的宿主选择。例如：

```json
{
  "remote.extensionKind": {
    "jyongli.codex-quota-vscode": ["workspace"]
  }
}
```

`["ui"]` 选择本地，`["workspace"]` 选择远程。设置保存到当前用户配置，因此会影响使用该配置的其他窗口；宿主迁移需要重载。插件一次只查询当前宿主，不会同时读取两端账号。未连接远程或尚未重载时会显示提示并停止额度查询。可通过 **Developer: Show Running Extensions** 核实运行位置。

浏览器版 VS Code、纯虚拟工作区及不受信任的工作区不在支持范围内。仅在一个宿主安装插件时，切换前须在另一端安装同一 VSIX。

## 官方接口与账号来源

查询采用 OpenAI 公开的 **Codex app-server 账号／额度协议**，由所选宿主的官方 CLI 执行 `codex app-server`，通过 stdio JSONL 通信：

1. `initialize` → `initialized`，完成握手。
2. `account/read`（`refreshToken: false`），读取 CLI 的有效登录类型、邮箱与计划。
3. ChatGPT 登录时调用 `account/rateLimits/read`。
4. 再读一次账号，若查询期间账号改变则拒绝混合快照。

当前实现使用官方支持的 CLI 协议入口；没有依赖未经确认的公网 REST 额度接口，也没有抓取交互式 `/status` 的终端文字。

官方参考：

- [Codex app-server 文档（0.116.0）：账号与额度](https://github.com/openai/codex/blob/rust-v0.116.0/codex-rs/app-server/README.md)
- [官方额度协议类型](https://github.com/openai/codex/blob/rust-v0.116.0/codex-rs/app-server-protocol/src/protocol/v2.rs)
- [VS Code 远程扩展：执行位置与 extensionKind](https://code.visualstudio.com/api/advanced-topics/remote-extensions#incorrect-execution-location)

**账号来源**是所选宿主的 Codex CLI 当前有效认证。配置目录优先使用 `codexQuota.codexHome`，其次继承该宿主 `CODEX_HOME`，默认 `~/.codex`；新版本以 `initialize` 返回的实际 `codexHome` 为准。凭据可能由 Codex 保存在此目录或系统凭据存储中。插件不读取 `auth.json`、不解码 JWT、不自行处理登录或发送 token。账号不是 VS Code 的 GitHub 登录，也不承诺与其他扩展显示的账号相同。

API Key、Amazon Bedrock 和未登录状态会分别标明，不伪造 ChatGPT 订阅额度。API Key 使用的 API 计费额度不等同于 ChatGPT Codex 的 5 小时／周额度。

辅助 app-server 的 SQLite 数据库和日志使用插件在**当前宿主**的 VS Code `globalStorageUri` 目录，通过官方 `sqlite_home` / `log_dir` 参数指定；登录配置目录保持所选来源。Codex 自身仍可能需要对其配置／凭据目录的正常写权限，例如进行内部令牌维护。

## 额度含义与异常处理

显示值为 `max(0, 100 - usedPercent)`，保留最多一位小数。按 `windowDurationMins` 识别 **300 分钟**及 **10080 分钟**，不假定 primary / secondary 的位置；多额度桶优先使用 `codex`，不混合其他模型的额度。

`—` 表示接口没有返回明确的对应窗口。未知时长不会被标成周额度；没有周窗口时不会假装剩余 100%。重置时间来自接口的 Unix 时间戳，以 VS Code 执行宿主的区域设置显示，不根据时间自行推断恢复额度。

请求超时、协议错误或网络失败后会清除旧数字并显示“查询失败”。设置变化取消旧查询；插件卸载会终止辅助进程。查询只调用初始化、账号读取与额度读取，不创建会话，不发起模型生成。

CLI 用参数数组启动，`shell: false`；路径不是 shell 命令，不能填写管道或额外参数。Windows 支持 `codex.exe` 以及官方 npm 的 `codex.cmd` 包装入口（转换为 `bin/codex.js`），也可直接配置官方 JS 入口的绝对路径。Windows 原生进程行为尚需在 Windows VS Code 中实测。

## 设置

| 设置 | 默认 | 说明 |
| --- | --- | --- |
| `codexQuota.statusBarPosition` | `right` | `left` / `right`，即时生效 |
| `codexQuota.cliPath` | `codex` | 当前执行宿主的 CLI 路径；机器级用户设置 |
| `codexQuota.codexHome` | 空 | 继承宿主配置；支持绝对路径和 `~/` |
| `codexQuota.refreshIntervalSeconds` | `300` | 自动刷新间隔，60–3600 秒 |
| `codexQuota.requestTimeoutSeconds` | `20` | 查询超时，5–120 秒 |

CLI 路径和 Codex 配置目录采用机器级配置，不接受工作区覆盖。工作区需要受到信任才能执行 CLI。插件不增加遥测、不上传账号信息；Codex 自身的网络和遥测遵循其官方配置。上游原始错误和 stderr 不写入插件 UI，避免意外暴露凭据。

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

该测试验证激活、额度状态、账号来源、位置切换和 API Key 状态。真实远程宿主验证仍需按上面的步骤在实际 SSH / WSL / 容器连接中安装并切换。按 F5 可启动扩展调试宿主。

打包结果位于 `artifacts/codex-quota-vscode-0.1.0.vsix`。只包含运行入口、清单、README、变更记录和许可证；没有运行时 npm 依赖，不包含测试、开发依赖或凭据。打包命令只生成本地文件，不推送或发布。

发布到 GitHub 使用 `.github/workflows/release.yml`：推送 `v*` 标签后完成测试、校验 `releases/<标签>` 中已验证的 VSIX，并创建附带安装包与 SHA256 的 Release。该工作流需要仓库启用 GitHub Actions；写权限仅赋予发布任务。

本次验证的具体结果与实测范围见仓库开发文档 `TESTING.md`（不包含在 VSIX 内）。
