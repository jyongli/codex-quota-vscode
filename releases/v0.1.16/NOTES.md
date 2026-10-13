Codex Quota 是一个 VS Code 插件。本版修复 Windows CLI 包装器无法解析导致“账号未能确认”和额度查询失败的问题。

- 常见 CMD／BAT／PowerShell 包装器按实际目标解析，支持独立 npm 前缀、pnpm／Yarn 全局目录和原生 `codex.exe` 入口，查询仍全程后台运行。
- 失效 PATH 项不会遮住后续可用 CLI；默认 `codex` 包装器无法解析时，复用或后台安装隔离的官方 CLI，沿用同一配置目录和登录账号，不覆盖原安装。
- 显式自定义路径不自动替换，失败诊断包含实际命中的包装器路径。
- CLI 与 IDE 的实际配置目录和登录账号同时一致时仍自动合并；无法确认时保留独立来源，不假定账号相同。
- 查询不执行包装器脚本内容，不读取认证文件；无需重载切换来源。

扩展 ID 保持 `ujyong.codex-quota-monitor-ujyong`。使用 **Install from VSIX / 从 VSIX 安装** 更新本附件。本地／远程环境安装同一个 VSIX，读取实际安装宿主的账号。Marketplace 网页更新请选择发布者 `ujyong` 和已有扩展的更新功能。

Linux 单元测试 75 项通过、3 项 Windows 专用测试跳过；Windows 78 项单元测试全部通过。两端实际打包入口 25 项、官方 CLI、真实 VS Code 宿主检查（Linux 14 组／Windows 15 组）通过。[Windows／Linux CI](https://github.com/jyongli/codex-quota-vscode/actions/runs/38363863775)通过，最终 VSIX 安装后 Linux 真实宿主检查再次通过。完整测试记录见 TESTING.md。
