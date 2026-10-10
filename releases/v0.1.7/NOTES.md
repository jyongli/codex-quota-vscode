Codex Quota 是一个 VS Code 状态栏插件，用于查看所选机器上 Codex CLI 当前账号的剩余额度。

本版只需安装一个 VSIX。首次选择远程查询时，会使用 VS Code 内置安装命令自动部署包内的远程组件，无须另外下载或安装第二个包。已有兼容组件直接复用；查询环境切换继续即时生效，不重载窗口。

- 保留中文／英文选择、内网及公网 IP、状态栏左右切换、5 小时／周额度显示。
- 安装等待支持超时、取消与并发合并；切回本地后，晚到安装不会覆盖当前账号。
- 内部远程组件仍会出现在远程扩展列表中，负责读取远程机器的 CLI 与账号。

在本地通过“从 VSIX 安装”安装 `codex-quota-vscode-0.1.7.vsix`。连接远程工作区，在远程机器安装并登录官方 Codex CLI，然后从插件菜单选择“远程”。CLI 不在 PATH 时，分别配置本地 `codexQuota.cliPath` 或远程 `codexQuota.remoteCliPath`。

Windows／Linux CI 已通过：Windows 66 项单元测试、两个平台各 21 项打包入口测试、官方 CLI 原生检查、10 组真实 VS Code 宿主断言和单个主 VSIX 打包。最终主包安装后的真实 VS Code 测试通过，没有预装远程组件或重启窗口。真实 SSH／WSL／容器连接与订阅账号在线额度尚未实机验收；范围见仓库 TESTING.md。

验证运行：https://github.com/jyongli/codex-quota-vscode/actions/runs/38044154597

下载后可用随附的 `.sha256` 文件校验。只发布 GitHub Release，未发布 VS Code Marketplace。

English: Install only `codex-quota-vscode-0.1.7.vsix`. On the first remote query, the extension installs its embedded workspace component through VS Code automatically, preserving immediate local / remote switching without reloading the window. Compatible existing components remain in use.

安装包：52772 字节；SHA256：`081aa767b998340895bfc351dbd854211b5c5e0bdfe3214da6d9f78d04b50ce4`。
