# 验证记录

## 0.1.3

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：37 项通过，1 项 Windows 原生测试按平台跳过。新增网卡 IP 的回环过滤、IPv4 优先、多网卡去重、数字 family、IPv6 和无地址处理；更新扩展测试，验证精简悬浮提示、专用账号来源菜单及刷新间隔设置变化。
- `npm run test:bundle`：10 项通过，加载实际打包入口。
- 真实 VS Code `1.95.3` Linux 扩展宿主：6 组断言通过，包含宿主 IP、刷新间隔、红框说明移出悬浮提示，以及官方 npm CLI `0.162.1` 启动。
- [Windows／Linux CI 第 11 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38035653261)：通过。Windows 38 项测试全部通过；两个平台均通过 10 项打包入口测试、官方 CLI 原生冒烟、6 组真实 VS Code 宿主断言及 VSIX 打包。
- 最终 0.1.3 VSIX ZIP／清单校验通过：7 个必要文件，运行入口与已验证入口字节一致。
- 在独立扩展目录安装最终 0.1.3 VSIX 后，真实 Linux VS Code 宿主测试通过，6 组断言。

IP 获取只读取实际执行宿主的网卡，不请求公网 IP 服务。多网卡与 IPv6 情形使用独立网卡数据测试；实际远程连接中的网卡与宿主迁移仍需实机验证。CLI 测试使用临时未登录配置，未读取真实凭据。

## 0.1.2

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：35 项通过，1 项 Windows 原生测试按平台跳过。新增提前退出的阶段／退出码／分类、敏感内容过滤，以及错误弹窗／诊断命令／重复提示行为验证。
- `npm run test:bundle`：10 项通过，加载实际打包入口。
- 官方 npm Codex CLI `0.162.1` 与 `0.116.0`：真实握手及未登录账号读取通过；覆盖空格／中文配置路径、自定义 SQLite 目录，以及无效配置目录导致提前退出时的诊断。
- 真实 VS Code `1.95.3` Linux 扩展宿主：6 组断言通过，包括错误诊断命令和实际启动官方 npm CLI `0.162.1`。账号使用独立临时未登录配置，无真实凭据。
- [Windows／Linux CI 第 9 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38034413188)：通过。Windows 36 项测试全部通过，含原生控制台探针及原生进程不继承 Electron Node 模式的断言；两个平台均通过 10 项打包入口测试、原生 CLI 冒烟、6 组真实 VS Code 宿主断言及 VSIX 打包。
- 最终 0.1.2 VSIX ZIP／清单校验：通过；7 个必要文件，包含诊断命令，入口与已实测入口字节相同。
- 将 0.1.2 VSIX 安装到独立扩展目录后运行真实 Linux VS Code 宿主：通过，6 组断言，包含官方 CLI 启动。

此前 Windows CI 的短路径／规范路径比较已在 0.1.1 修正。本次新增诊断测试中的 Windows 路径 JSON 转义断言已改为解析 JSON 后比较字段，保留了有效的来源断言。

用户机器上的具体提前退出原因尚未取得退出码。本版移除 CLI 数据目录覆盖、显式使用 stdio 并改善诊断；以上测试不代表已验证用户的 ChatGPT 登录或真实在线额度。实际远程宿主、ARM64 原生执行及用户桌面上的 Windows Terminal 仍需实机验证。

## 0.1.1

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：33 项通过，1 项 Windows 原生窗口测试按平台跳过；覆盖 Windows x64／ARM64、官方 npm 平台依赖／旧 vendor、新旧二进制目录、缺少依赖与超时阶段。
- `npm run test:bundle`：9 项通过，加载实际打包入口。
- 官方 npm Codex CLI `0.162.1`：真实初始化与账号读取通过，使用临时未登录配置，不读取实际凭据。
- 真实 VS Code `1.95.3` Linux 扩展宿主：激活／账号来源、位置切换、仅周额度、API Key 状态 4 组断言通过。
- [Windows／Linux CI 第 6 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38032519526)：通过。Windows 34 项测试全部通过，含原生控制台探针（调用 `GetConsoleWindow`，确认查询进程没有控制台）；打包入口 9 项、真实 VS Code 宿主 4 组及官方 npm CLI `0.162.1` 的未登录冒烟均通过。Release 必须等待 Windows 检查通过。
- VSIX 安装及安装后 Linux 宿主测试：通过，4 组断言。最终发布包的入口与已实测的安装入口字节一致，ZIP／清单校验通过，版本为 `0.1.1`。

窗口探针使用 Windows 自带 .NET Framework C# 编译器构建独立控制台程序，不访问凭据。真实 ChatGPT 订阅额度、用户桌面上的 Windows Terminal、ARM64 原生执行及实际远程机器仍需实机验收。

## 0.1.0

验证日期：2026-10-10。环境：Linux x64、Node.js 24.19.0、npm 11.9.0。

| 检查 | 结果 | 实际范围 |
| --- | --- | --- |
| `npm test` | 30/30 通过，0 跳过 | 额度／账号解析、真实子进程 JSONL 往返、取消／超时／错误、模拟 VS Code API 的宿主与状态栏行为 |
| `npm run test:bundle` | 9/9 通过，0 跳过 | 同样的扩展行为测试加载实际 `dist/extension.js` |
| 官方 CLI 0.116.0 原生冒烟 | 通过 | 官方 npm 包；新建未登录配置目录；真实 `initialize` / `account/read`，账号为未登录，无虚构额度 |
| 预装 CLI 0.159.0-alpha.3 原生冒烟 | 通过 | 新建未登录配置目录，真实握手与账号读取 |
| 真实 VS Code 1.95.3 宿主 | 通过，4 组断言 | Xvfb；实际 Node 扩展宿主；真实子进程协议测试账号；激活与账号来源、状态栏切换、仅周额度、API Key 状态 |
| `npm run package` | 通过 | 生成 0.1.0 VSIX，无发布动作 |
| VSIX ZIP 与清单检查 | 通过 | ZIP 校验、7 个必要文件、入口存在、命令／宿主清单正确，无测试、node_modules 或凭据 |
| VSIX 安装及安装后宿主测试 | 通过，4 组断言 | 官方 VS Code CLI 成功安装 `jyongli.codex-quota-vscode@0.1.0`；测试宿主直接加载该安装目录中的 VSIX 入口 |

原生 CLI 测试使用独立未登录配置，不读取真实账号凭据。模拟协议账号的邮箱均为 `example.test`。宿主测试额度来自协议测试进程，不能据此声称已查询过真实订阅账号。

VS Code 自动下载地址在本环境被网络策略拒绝。本次使用允许访问的微软官方 Debian 软件源下载固定 1.95.3：验证 Microsoft Release 签名、索引 SHA256、DEB SHA256 后提取到 `/workspace/scratch/codex-quota-test-tools`，未修改系统安装。Xvfb 同样由已验证的 Debian 官方签名与 SHA256 取得。测试进程已结束。

预装 CLI 默认的 `CODEX_HOME` 是平台只读目录，启动 app-server 时无法写入其内部状态。因此原生测试使用临时未登录目录，未更改平台凭据。0.1.0 中的辅助 SQLite／日志目录使用 VS Code 的全局存储；0.1.2 起沿用 CLI 自身配置的目录。Codex 本身仍需其正常的配置目录写权限。

以下范围未实测：

- 已登录 ChatGPT 账号向官方后端查询真实剩余额度；本次仅验证临时未登录配置，未使用用户的 ChatGPT 登录状态。
- 在真实 SSH / WSL / Dev Container / Codespaces 中，重载后跨宿主切换与各自账号读取。已验证宿主判断、配置保留、待重载阻止旧端查询，以及远程分支的模拟行为。
- Windows / macOS 的原生进程启动与系统凭据存储。Windows npm shim 的解析已通过逻辑测试。

以上记录是发布前完成的本机验证。仓库包含真实 VS Code 宿主测试入口与 CI／Release 工作流，在线运行结果以 GitHub Actions 为准。真实远程验收步骤见 README 的“本地／远程选择”。
