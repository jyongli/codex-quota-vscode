Codex Quota 是一个 VS Code 插件。本版修复 Marketplace 提示扩展名称已经存在的问题。

- 扩展名称改为 `codex-quota-monitor-ujyong`，发布者保持 `ujyong`，完整 ID 为 `ujyong.codex-quota-monitor-ujyong`。
- 新 VSIX 文件为 `codex-quota-monitor-ujyong-0.1.13.vsix`；JSON／XML 清单名称、发布者和版本已统一。
- VS Code 显示名称仍为 Codex Quota；语言／位置设置、额度查询、IP 和后台 Codex CLI 自动安装继续使用。
- 打包、CI 和 Marketplace 发布配置同步采用新名称；Linux CI 通过官方公开查询检查其他发布者的同名扩展。

在 [Marketplace 发布者管理](https://marketplace.visualstudio.com/manage) 选择 **ujyong → New extension → Visual Studio Code**，上传此新包。旧包 `0.1.12` 仍使用已被占用的 `codex-quota-vscode`，请不要再次上传旧包。网页上传不需要 GitHub `VSCE_PAT`；实际商店校验和上架状态以网页结果为准。

若安装过 `jyongli.codex-quota-vscode` 或 `ujyong.codex-quota-vscode`，请先在本地与对应远程端卸载旧插件，再安装新版，避免重复状态栏。现有 `codexQuota.*` 设置与 Codex CLI 登录继续使用。

单元测试、打包入口与最终 VSIX 安装后的实际 Linux VS Code 验证通过；[Windows／Linux CI](https://github.com/jyongli/codex-quota-vscode/actions/runs/38110569682)通过，官方公开查询未发现其他发布者使用此完整名称。查询不等于名称预留，最终以上传校验为准；实测范围见 TESTING.md。
