Codex Quota 是用于在 VS Code 状态栏显示 Codex CLI 账号剩余额度的插件。

本版沿用 CLI 自身配置、数据库及日志目录，显式使用 stdio 通信，并保留 Windows 官方 npm 包的启动环境信息。查询继续在隐藏窗口的后台进程运行。

查询失败现在会主动弹出提示。点击“查看诊断”，或运行“Codex Quota: 查看诊断日志”，可查看失败阶段、CLI 路径、配置目录、退出码和固定错误分类。自动刷新遇到相同错误不重复弹窗，手动重试仍会提示。

Windows 与 Linux CI 均通过：Windows 36 项单元测试、两个平台各 10 项打包入口测试、官方 npm Codex CLI 0.162.1 原生冒烟、真实 VS Code 宿主启动该 CLI，以及打包。另已验证 Linux 安装后的 VSIX 宿主行为。原生测试使用临时未登录配置，未使用实际账号凭据；用户机器上的具体退出原因仍需通过新版诊断确认。

验证运行：https://github.com/jyongli/codex-quota-vscode/actions/runs/38034413188

下载下方 VSIX，通过 VS Code 的“从 VSIX 安装”更新，然后重载窗口。

VSIX 字节数：20610
SHA256：`ba7f03ad763571043a8168306813d0bb9a3349d55cd15e1321f480b3c7ae53a2`
