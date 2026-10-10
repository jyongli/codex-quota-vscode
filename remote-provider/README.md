# Codex Quota Remote

这是 **VS Code 插件 Codex Quota 的远程查询组件**。主插件安装在本地，当前组件安装在要查询的 SSH、WSL、Dev Container 或 Codespaces 远程端。

在远程端安装官方 Codex CLI，并用 ChatGPT 账号登录。然后在主插件状态栏菜单中选择“远程”，即可查询远程账号；本地／远程切换立即生效，无须重载窗口。

本组件使用 `codexQuota.remoteCliPath`、`codexQuota.remoteCodexHome` 机器级设置，请在远程用户设置中配置。本地查询使用另一组 `codexQuota.cliPath`、`codexQuota.codexHome` 本地用户设置，避免 VS Code 合并配置时混用路径。CLI 路径默认 `codex`；配置目录留空时，由相应宿主的 PATH、CODEX_HOME 和默认配置目录决定。

本组件读取官方 `account/read` 和 `account/rateLimits/read` 协议，不读取凭据文件。查询在隐藏窗口的后台进程运行，取消、超时及组件退出都会终止查询。升级时如有自定义远程 CLI 或配置目录，请将旧远程设置改为上述 `remoteCliPath`、`remoteCodexHome`。

请安装与主插件相同版本的组件。具体安装与升级步骤见 [主仓库说明](https://github.com/jyongli/codex-quota-vscode#readme)。

0.1.6 起，当主插件启用公网 IP 显示时，由本组件在远程宿主通过 HTTPS ipify 获取出口地址；3 秒独立超时，成功缓存 5 分钟，失败不影响额度查询。错误信息通过可翻译的协议传回，由主插件当前所选中／英文显示。

This is the **remote workspace component of the Codex Quota VS Code extension**. Install it on the remote host and keep its version aligned with the local main extension. It uses the remote machine’s Codex CLI, account, network interface IP and public outbound IP. Public IP lookup failure does not prevent quota queries. The main extension controls Chinese / English display language. See the [English guide](https://github.com/jyongli/codex-quota-vscode/blob/main/README.en.md).
