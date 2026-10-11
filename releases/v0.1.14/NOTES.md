Codex Quota 是一个 VS Code 插件。本版新增图标、简短商店介绍与多个查询来源的选择。

- 商店简介：Show Codex 5-hour and weekly quota usage in the VS Code status bar.
- 单个可查询来源直接显示；多个来源等待用户选择，并保存所选来源 ID。
- 切换取消旧查询并清除旧数字，无需重载窗口或写入设置。
- 支持当前宿主的 CLI 配置账号、额外 `codexQuota.environments` 账号目录，以及同宿主官方 Codex 插件可访问的共享配置账号。
- 同一账号的 CLI／IDE 额度共享。IDE 来源明确标为“配置账号”，不保证等于其内存登录状态或其他内部 SSH 连接；其他宿主与 Windows 内 WSL 不冒用本机账号。相应宿主需安装本插件查询。

包身份保持 `ujyong.codex-quota-monitor-ujyong`，从 0.1.13 更新无需换 ID。可通过 **Install from VSIX / 从 VSIX 安装** 安装本附件。在 Marketplace 发布者管理中选择 **ujyong**：已上架时选已有扩展的更新功能上传本包，尚未上架时新建 Visual Studio Code 扩展。网页上传不需要 GitHub `VSCE_PAT`；仓库自动发布仍需该密钥。

Linux 单元测试 62 项通过、1 项 Windows 专用测试跳过；实际打包入口 21 项通过，官方 CLI 原生与最终 VSIX 安装后的真实 VS Code 13 组验证通过。[Windows／Linux CI](https://github.com/jyongli/codex-quota-vscode/actions/runs/38118030640)通过；完整测试范围和接口限制见 TESTING.md。
