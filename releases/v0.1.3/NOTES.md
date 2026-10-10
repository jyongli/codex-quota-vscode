Codex Quota 是用于在 VS Code 状态栏显示 Codex CLI 账号剩余额度的插件。

本版按用户截图精简悬浮提示：

- 移除接口来源、账号来源说明、CLI 路径、配置目录与凭据说明。
- 将执行环境文字改为插件实际运行宿主的网卡 IP 地址；本地模式显示本机，远程模式显示远程宿主。优先非回环 IPv4，支持多网卡去重及 IPv6，不请求公网 IP 服务。
- 增加刷新时间间隔，例如“5 分钟（300 秒）”，与轮询设置同步更新。

账号来源与路径仍可通过“查看账号与额度来源”菜单查看。

Windows／Linux CI 已通过，包含 Windows 38 项单元测试、两个平台各 10 项打包入口测试、官方 npm CLI 0.162.1 原生冒烟、真实 VS Code 宿主验证及打包。最终 VSIX 也已安装到独立目录，完成 Linux 宿主验证。

验证运行：https://github.com/jyongli/codex-quota-vscode/actions/runs/38035653261

下载下方 VSIX，通过 VS Code 的“从 VSIX 安装”更新，然后重载窗口。

VSIX 字节数：21327
SHA256：`30e73c543c6374cf8ec5e7ba9bb634feebaedc3366423f3814721479d01133c5`
