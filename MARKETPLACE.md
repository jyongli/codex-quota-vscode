# 发布到 VS Code Marketplace

发布者 ID：**`ujyong`**。扩展 ID：**`ujyong.codex-quota-monitor-ujyong`**。GitHub 仓库仍为 `jyongli/codex-quota-vscode`，GitHub 用户名不需要与 Marketplace 发布者 ID 相同。商店发布单个 VSIX；同一个插件可安装在本地与远程端，读取实际安装宿主的 Codex CLI 账号和额度。

## 网页上传

1. 使用 Microsoft 账号打开 [Marketplace 发布者管理](https://marketplace.visualstudio.com/manage)，选择已有发布者 **`ujyong`**。
2. 从 [GitHub Release v0.1.15](https://github.com/jyongli/codex-quota-vscode/releases/tag/v0.1.15) 下载 **`codex-quota-monitor-ujyong-0.1.15.vsix`**。
3. 首次发布时点击 **New extension → Visual Studio Code**，上传该 VSIX；如果 `ujyong.codex-quota-monitor-ujyong` 已存在，则在该扩展的菜单选择更新并上传新版。

网页上传使用当前 Microsoft 账号的发布者权限，无须配置 GitHub 的 `VSCE_PAT`。VSIX 中 `package.json` 和 `extension.vsixmanifest` 的发布者都必须是 `ujyong`，否则会出现 Publisher ID 不匹配错误；本版打包校验同时检查这两处。

本版包名为 **`codex-quota-monitor-ujyong`**。原 `codex-quota-vscode` 名称已被占用，上传 `0.1.12` 会出现 “The extension already exists” 错误；这不能只靠修改发布者解决，必须同时更改 `package.json` 的 `name` 和 VSIX 身份。`0.1.11` 及更早的包还使用旧发布者 `jyongli`。从 `0.1.13` 起使用新扩展 ID，请使用 `0.1.15` 的最新安装包。

已安装旧 `jyongli.codex-quota-vscode` 或 `ujyong.codex-quota-vscode` 的用户需要先在本地／远程端卸载旧插件，再安装新版；这些扩展 ID 是独立的。现有 `codexQuota.*` 设置和 Codex CLI 登录仍可使用。

Linux CI 会通过官方 `vsce search` 检查公开商店是否已有其他发布者使用相同名称；查询失败只记录未确认，不使构建因外部网络故障失败。公开查询不能预留名称或排除未公开的提交，最终仍以 Marketplace 上传校验为准。

## GitHub Actions 自动发布配置

1. 确认用于发布的 Microsoft 账号有权限管理发布者 **`ujyong`**。
2. 在 [Azure DevOps](https://dev.azure.com/) 创建 Personal Access Token：组织选择 **All accessible organizations**，权限只需 **Marketplace → Manage**，设置合理有效期。官方步骤见 [VS Code 发布文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token)。
3. 打开 [仓库 Actions Secrets](https://github.com/jyongli/codex-quota-vscode/settings/secrets/actions)，新建 Repository secret **`VSCE_PAT`**，把令牌保存为值。不要把令牌写入仓库、日志或聊天。

## 自动发布已验证版本

打开 [Publish VS Code Marketplace 工作流](https://github.com/jyongli/codex-quota-vscode/actions/workflows/marketplace.yml)，点击 **Run workflow**，选择 `main`，`release_tag` 填写 **`v0.1.15`**。

流程检查该标签提交已通过 Windows／Linux CI，下载已发布到 GitHub 的主 VSIX，与标签中记录的 SHA256 对比，并验证发布者、版本、单包、workspace 执行清单与机器级路径设置。随后通过官方 `vsce verify-pat ujyong` 检查发布权限，使用 `vsce publish --packagePath` 上传已有包，不重新打包。重复运行会跳过商店中已存在的同版本。

缺少 `VSCE_PAT` 时，流程跳过自动发布，并在运行摘要说明如何配置；这种配置缺失不会产生构建失败邮件。也可直接使用上面的网页上传方式。有凭据后的权限错误、包校验错误或上传失败仍会使流程失败，便于定位问题。

Marketplace 会进行验证和索引；上传成功后，可能需要等待几分钟才会出现在商店。上架后可在 VS Code 搜索 **Codex Quota**，确认发布者为 `ujyong`，或执行：

```sh
code --install-extension ujyong.codex-quota-monitor-ujyong
```

商店地址：https://marketplace.visualstudio.com/items?itemName=ujyong.codex-quota-monitor-ujyong

工作流会单独检查公开商店的版本，并在摘要区分“已提交”“公开版本已确认”或“验证／索引仍待完成”。缺少凭据时明确记录未尝试上传。
