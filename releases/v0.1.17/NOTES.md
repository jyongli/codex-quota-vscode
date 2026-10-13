Codex Quota 是一个 VS Code 插件。本版修复 Marketplace 提示图标超过 1024 KB、无法上传的问题。

- 图标缩小为 256×256，通过用户指定的 Tinify 压缩为 22,322 字节（约 21.8 KB），保留原有图案，远低于上传限制。
- 打包前与最终 VSIX 使用同一图标体积检查，旧版过大图标会被明确拒绝。
- 保留 0.1.16 的 Windows CLI 包装器解析、后台备用安装和账号来源自动合并修复。

更新请在 Marketplace 发布者 `ujyong` 下选择已有 Codex Quota 扩展的更新功能，上传此版本的 VSIX。扩展 ID 保持 `ujyong.codex-quota-monitor-ujyong`；已有的 0.1.15 可直接更新至 0.1.17。本地安装可通过 **Install from VSIX / 从 VSIX 安装** 更新。

Tinify 的实际 HTTP 压缩结果与新 PNG 已验证；[Windows／Linux CI](https://github.com/jyongli/codex-quota-vscode/actions/runs/38413802751) 通过，最终 VSIX 安装后的真实 VS Code 宿主检查通过。完整记录见 TESTING.md。
