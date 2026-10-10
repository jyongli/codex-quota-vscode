# 验证记录

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

预装 CLI 默认的 `CODEX_HOME` 是平台只读目录，启动 app-server 时无法写入其内部状态。因此原生测试使用临时未登录目录，未更改平台凭据。产品中的辅助 SQLite／日志目录使用 VS Code 的全局存储；Codex 本身仍需其正常的配置目录写权限。

以下范围未实测：

- 已登录 ChatGPT 账号向官方后端查询真实剩余额度；本次仅验证临时未登录配置，未使用用户的 ChatGPT 登录状态。
- 在真实 SSH / WSL / Dev Container / Codespaces 中，重载后跨宿主切换与各自账号读取。已验证宿主判断、配置保留、待重载阻止旧端查询，以及远程分支的模拟行为。
- Windows / macOS 的原生进程启动与系统凭据存储。Windows npm shim 的解析已通过逻辑测试。

以上记录是发布前完成的本机验证。仓库包含真实 VS Code 宿主测试入口与 CI／Release 工作流，在线运行结果以 GitHub Actions 为准。真实远程验收步骤见 README 的“本地／远程选择”。
