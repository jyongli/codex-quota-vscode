Codex Quota 是一个 VS Code 插件。本版使用同一个扩展 ID、同一个 VSIX，按安装环境读取 Codex CLI 的账号和额度。

- 本地窗口：安装在本地，读取本机 CLI、账号和 IP。
- SSH／WSL／容器窗口：在当前远程端安装同一插件，读取远程机器的 CLI、账号和 IP；两端都安装时，远程窗口使用远程端。
- 移除手动环境切换及内置第二扩展。插件不要求重载窗口；首次安装／升级由 VS Code 原生安装流程管理。
- 保留双语、内网／公网 IP、5 小时＋周／仅周额度和状态栏即时左右切换。
- CLI 与配置目录统一使用当前机器的 `codexQuota.cliPath`／`codexQuota.codexHome`；旧远程键作为兼容回退。

下载这一个 VSIX 即可在两端分别安装。旧的 Codex Quota Remote 组件可卸载。安装环境需要安装并登录官方 Codex CLI。

本地单元测试、打包入口及实际安装后的 VS Code 宿主测试通过；Windows／Linux CI：[验证结果](https://github.com/jyongli/codex-quota-vscode/actions/runs/38065067932)。实际 SSH／WSL／容器连接尚未实机验收，详情见 TESTING.md。
