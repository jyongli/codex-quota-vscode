Codex Quota 是一个 VS Code 插件。本版新增 Codex CLI 检测与后台自动安装。

- 在插件实际安装宿主检测 CLI：本地安装检测本机，远程安装检测远程机器。
- 已有 CLI 优先使用；默认 `codex` 命令缺失时自动安装官方 `@openai/codex` npm 包，随后查询额度并复用安装结果。
- 安装在插件专用存储中进行，不弹出命令行窗口、不需要管理员权限、不改系统 PATH 或全局 CLI、不要求重载窗口。
- 状态栏显示安装进度；失败提示区分 npm 缺失、网络／代理／证书、权限及平台包问题，可刷新重试。
- 自定义 CLI 路径不会自动替换；`codexQuota.autoInstallCli: false` 可关闭自动下载。
- 沿用该机器的 Codex 配置与登录状态；未登录时单独显示“未登录”，在该机器运行 `npx @openai/codex login` 后刷新。自定义配置目录须使用同一 `CODEX_HOME`。

自动安装需要该机器已有 npm 并能访问官方 npm 仓库。插件不会代为登录 ChatGPT。状态栏左右位置、双语、IP 和额度显示沿用上一版本。

本地单元测试、打包入口、真实官方 npm 下载与 CLI 查询、最终 VSIX 安装后的实际 VS Code 宿主测试通过。[Windows／Linux CI 验证](https://github.com/jyongli/codex-quota-vscode/actions/runs/38105442863)通过；具体实测范围见 TESTING.md。
