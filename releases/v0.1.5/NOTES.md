Codex Quota 是用于在 VS Code 状态栏显示 Codex CLI 账号剩余额度的插件。

- 修复“切换状态栏左右位置”在工作区设置覆盖下点击无效的问题，点击后立即移动。
- 本地／远程查询立即切换，不再弹出重载窗口提示；切换时取消旧请求并清除旧额度。
- 分开本地与远程 CLI 设置，避免 VS Code 合并配置后混用路径。版本不兼容的远程组件会被明确拒绝。
- 保留精简悬浮提示：显示查询宿主的内网 IP、账号、额度、重置时间、查询时间和刷新时间间隔。

安装：在本地安装 `codex-quota-vscode-0.1.5.vsix`。需要远程查询时，在远程端一次性安装同版本 `codex-quota-remote-0.1.5.vsix`，并登录该端的 Codex CLI。之后切换环境无须重载窗口；旧版主插件已被强制安排在远程端的用户，首次升级可能需要重新加载扩展以应用本地主插件宿主。

本机自定义路径继续使用 `codexQuota.cliPath`、`codexQuota.codexHome`。自定义远程路径请在远程用户设置中改用 `codexQuota.remoteCliPath`、`codexQuota.remoteCodexHome`。默认 CLI 为 `codex`，配置目录留空时继承相应机器的 Codex 配置。

Windows／Linux CI 已通过：Windows 45 项单元测试、两个平台各 15 项打包入口测试、官方 npm CLI `0.162.1` 原生冒烟、7 组真实 VS Code 宿主断言及两个 VSIX 打包。两个最终 VSIX 已完成独立安装后的 Linux 宿主验证。实际 SSH / WSL / 容器连接尚未实机验收，CLI 原生测试使用独立临时未登录配置。

验证运行：https://github.com/jyongli/codex-quota-vscode/actions/runs/38038980495

CI 已增加 15 分钟执行时限、固定 VS Code 下载缓存和同分支并发控制；发布验证通过后会取消被新版替代的旧主分支构建。

codex-quota-vscode-0.1.5.vsix：23116 字节；SHA256：`5675ce1068383b50cede03a42c8d2dfd878e0f5f8ae7b73464a7c0b607c4b31e`。

codex-quota-remote-0.1.5.vsix：11032 字节；SHA256：`07bfc7b703cf5410a3bc0590c7fb7c07a1e7c066ed12e65149cf7876762b8153`。
