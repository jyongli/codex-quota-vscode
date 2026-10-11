Codex Quota 是一个 VS Code 插件。本版修复 Marketplace 上传时发布者 ID 不匹配的问题。

- 发布者更正为你的商店账号下的 `ujyong`；扩展 ID 为 `ujyong.codex-quota-vscode`。
- VSIX 中的 `package.json` 与 `extension.vsixmanifest` 均已使用 `ujyong`，CI 增加两份清单的身份一致性检查。
- “打开设置”按当前扩展 ID 定位，保留语言／位置即时配置。
- GitHub 仓库地址保持 `jyongli/codex-quota-vscode`。CLI 检测、后台自动安装和按插件安装环境查询额度的行为保持一致。

在 [Marketplace 发布者管理](https://marketplace.visualstudio.com/manage) 中选择 **ujyong**，点击 **New extension → Visual Studio Code** 并上传此版本的 VSIX；网页上传无需 GitHub `VSCE_PAT`。

如果安装过旧 `jyongli.codex-quota-vscode`，请先在本地与对应远程端卸载旧插件，再安装本版；VS Code 视这两个 ID 为不同扩展，保留两者会产生重复状态栏。现有 `codexQuota.*` 设置与 Codex CLI 登录继续使用，无须重新登录。

单元测试、打包入口与最终 VSIX 安装后的实际 Linux VS Code 宿主验证通过；[Windows／Linux CI](https://github.com/jyongli/codex-quota-vscode/actions/runs/38109090060)通过，实测范围见 TESTING.md。
