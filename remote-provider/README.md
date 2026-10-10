# Codex Quota Remote

这是 **VS Code 插件 Codex Quota 的远程查询组件**。主插件安装在本地，当前组件安装在要查询的 SSH、WSL、Dev Container 或 Codespaces 远程端。

在远程端安装官方 Codex CLI，并用 ChatGPT 账号登录。然后在主插件状态栏菜单中选择“远程”，即可查询远程账号；本地／远程切换立即生效，无须重载窗口。

本组件使用远程宿主的 `codexQuota.cliPath`、`codexQuota.codexHome` 机器级用户设置，读取官方 `account/read` 和 `account/rateLimits/read` 协议，不读取凭据文件。查询在隐藏窗口的后台进程运行，取消、超时及组件退出都会终止查询。

请安装与主插件相同版本的组件。具体安装与升级步骤见 [主仓库说明](https://github.com/jyongli/codex-quota-vscode#readme)。
