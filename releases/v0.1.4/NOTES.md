Codex Quota 是用于在 VS Code 状态栏显示 Codex CLI 账号剩余额度的插件。

- 修复点击“切换状态栏左右位置”无效：存在工作区覆盖时更新工作区设置，状态栏立即移动。
- 本地／远程查询切换立即生效，不再弹出重载窗口提示。切换时取消旧请求，防止旧账号或晚到额度覆盖新结果。
- 新增 Codex Quota Remote 查询组件，使用远程机器自己的 CLI、登录账号与网卡 IP。主插件负责本地查询和状态栏。

安装：

1. 在本地端安装 `codex-quota-vscode-0.1.4.vsix`。
2. 需要远程查询时，连接远程工作区，在远程端一次性安装 `codex-quota-remote-0.1.4.vsix`，并确保该端 Codex CLI 已登录。
3. 从状态栏菜单选择查询环境即可，无须在每次切换时重载。旧版已经强制主插件在远程运行的用户，首次升级可能需要重新加载扩展，以应用主插件的本地宿主。

Windows／Linux CI 已通过：Windows 45 项单元测试、两个平台各 15 项打包入口测试、官方 npm CLI 0.162.1 原生冒烟、7 组真实 VS Code 宿主断言，以及两个 VSIX 的打包。最终安装包也已完成独立安装后的 Linux 宿主验证。真实 SSH / WSL / 容器连接尚未实机验收；双宿主隔离与取消行为由独立协议测试子进程验证。

验证运行：https://github.com/jyongli/codex-quota-vscode/actions/runs/38037818868

codex-quota-vscode-0.1.4.vsix：22613 字节；SHA256：`71e28fd154b71e15be157377fc8470958024f266f6d143f92c7cc2c805483e09`。

codex-quota-remote-0.1.4.vsix：10783 字节；SHA256：`56923ac942ea5ae3e5193a87d9b0d4ac01abf952a62a855968e68ae765948062`。
