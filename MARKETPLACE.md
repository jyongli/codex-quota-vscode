# 发布到 VS Code Marketplace

发布 ID：`jyongli.codex-quota-vscode`。商店发布单个 VSIX、单个扩展 ID；同一个插件可安装在本地与远程端，读取实际安装宿主的 Codex CLI 账号和额度。

## 首次配置

1. 使用 Microsoft 账号打开 [Marketplace 发布者管理](https://marketplace.visualstudio.com/manage)，创建或确认你有权限管理的发布者 **`jyongli`**。GitHub 同名账号不会自动创建 Marketplace 发布者。
2. 在 [Azure DevOps](https://dev.azure.com/) 创建 Personal Access Token：组织选择 **All accessible organizations**，权限只需 **Marketplace → Manage**，设置合理有效期。该 Microsoft 账号必须拥有发布者的发布权限。官方步骤见 [VS Code 发布文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token)。
3. 打开 [仓库 Actions Secrets](https://github.com/jyongli/codex-quota-vscode/settings/secrets/actions)，新建 Repository secret **`VSCE_PAT`**，把令牌保存为值。不要把令牌写入仓库、日志或聊天。

## 发布已验证版本

打开 [Publish VS Code Marketplace 工作流](https://github.com/jyongli/codex-quota-vscode/actions/workflows/marketplace.yml)，点击 **Run workflow**，选择 `main`，`release_tag` 填写 **`v0.1.11`**。本版检测所在机器的 Codex CLI，并在默认命令缺失时自动后台安装；继续按插件安装环境查询额度，请使用此版本。

流程检查该标签提交已通过 Windows／Linux CI，下载已发布到 GitHub 的主 VSIX，与标签中记录的 SHA256 对比，并验证单包、workspace 执行清单与机器级路径设置。随后通过官方 `vsce verify-pat` 检查发布权限，使用 `vsce publish --packagePath` 上传已有包，不重新打包。重复运行会跳过商店中已存在的同版本。

缺少 `VSCE_PAT` 时，流程跳过发布，并在运行摘要说明如何配置；这种配置缺失不会产生构建失败邮件。有凭据后的权限错误、包校验错误或上传失败仍会使流程失败，便于定位问题。

Marketplace 会进行验证和索引；工作流上传成功后，可能需要等待几分钟才会出现在商店。上架后可在 VS Code 搜索 **Codex Quota**，确认发布者为 `jyongli`，或执行：

```sh
code --install-extension jyongli.codex-quota-vscode
```

商店地址：https://marketplace.visualstudio.com/items?itemName=jyongli.codex-quota-vscode

工作流会单独检查公开商店的版本，并在摘要区分“已提交”“公开版本已确认”或“验证／索引仍待完成”。缺少凭据时明确记录未尝试上传。
