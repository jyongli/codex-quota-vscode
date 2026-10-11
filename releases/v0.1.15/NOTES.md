Codex Quota 是一个 VS Code 插件。本版先自动检测实际配置目录和登录账号，解决 CLI 与官方 VS Code Codex 重复来源的问题。

- 通过官方 `initialize`／`account/read` 检测实际 `.codex` 路径与账号，只有两项同时一致才合并；合并后单一来源直接显示额度。
- 支持继承 `CODEX_HOME`、显式目录、符号链接和 Windows 路径大小写；账号不同、目录不同或身份无法确认时保留独立来源。
- 不同来源保留上次有效选择，首次自动弹出选择框，显示检测到的实际路径和账号。
- 取消后不随自动刷新重复弹窗；切换无需重载，不保留旧账号的额度数字，兼容合并前保存的来源 ID。
- 检测不读取认证文件、不在选择前请求额度。官方 IDE 来源仍是当前宿主的共享配置账号，不能读取插件内存会话或其内部其他 SSH 连接；同一账号 CLI／IDE 共享额度。

扩展 ID 保持 `ujyong.codex-quota-monitor-ujyong`。使用 **Install from VSIX / 从 VSIX 安装** 安装本附件。Marketplace 发布者管理中选择 **ujyong**，通过已有扩展的更新功能上传本包；网页上传不需要 GitHub `VSCE_PAT`。

Linux 单元测试 70 项通过、1 项 Windows 专用项跳过；实际打包入口 24 项通过，官方 CLI 冒烟检查通过。真实 VS Code 与最终 VSIX 安装验证均通过 14 组断言。[Windows／Linux CI](https://github.com/jyongli/codex-quota-vscode/actions/runs/38131389142)通过。完整测试范围和接口限制见 TESTING.md。
