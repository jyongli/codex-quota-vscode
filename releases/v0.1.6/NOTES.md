Codex Quota 是在 VS Code 状态栏显示所选机器 Codex CLI 账号剩余额度的插件。

- 新增显示语言选择：点击状态栏 → 选择显示语言，可选择跟随 VS Code、中文、English。菜单、状态栏、悬浮提示及错误即时切换，保留当前额度，无须重载窗口。
- 原有 IP 地址下增加公网 IP，由实际查询机器通过 HTTPS ipify 获取。本地模式显示本机出口，远程模式显示远程宿主出口；成功缓存 5 分钟，独立超时 3 秒，失败不影响额度查询。
- 可通过 `codexQuota.showPublicIp: false` 隐藏公网 IP 并停止请求。
- 保留本地／远程即时切换、左右位置切换及独立账号来源设置。远程协议已升级，请同步升级两个组件。

安装：本地安装 `codex-quota-vscode-0.1.6.vsix`；需要远程查询时，在远程端安装同版本 `codex-quota-remote-0.1.6.vsix`。插件显示语言设置为 `codexQuota.language`（`auto` / `zh-CN` / `en`）。原生命令面板标题和设置页翻译跟随 VS Code 界面语言。

Windows／Linux CI 均已通过：Windows 57 项单元测试、两个平台各 19 项打包入口测试、官方 npm CLI `0.162.1` 原生冒烟、9 组真实 VS Code 宿主断言及两个 VSIX 打包。最终两个包也已完成独立安装后的 Linux 宿主验证。网络取址使用独立 HTTP 响应验证；实际 SSH / WSL / 容器与真实订阅账号未实机验收。

验证运行：https://github.com/jyongli/codex-quota-vscode/actions/runs/38041568764

English: Select **Choose display language** from the status bar menu to use **Follow VS Code**, **中文**, or **English** immediately. The tooltip now includes **Public IP**, retrieved by the selected local or remote host. Lookup failure leaves quota querying available. Install matching 0.1.6 main and remote VSIX files when using remote queries.

codex-quota-vscode-0.1.6.vsix：34012 字节；SHA256：`70a622442f5a9d33a95d87c0ea0081756801c8d073c4d761e5f53dcea0a6a947`。

codex-quota-remote-0.1.6.vsix：16968 字节；SHA256：`f98ab45567163823b576c75f3d3a6a9bc944418b66f1e5b4ab1aac889bea38a1`。

