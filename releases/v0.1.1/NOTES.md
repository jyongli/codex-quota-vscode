修复 Windows 查询时弹出命令行窗口，并改善查询超时处理。

- 官方 npm `codex.cmd`／`bin/codex.js` 入口直接解析到原生 `codex.exe`，使用隐藏窗口的后台进程和管道通信，避免包装器二次启动窗口。
- 支持 Windows x64／ARM64、官方平台依赖及旧版内置 vendor 布局；查询完成、取消或超时后回收辅助进程。
- 默认查询超时从 20 秒调整为 60 秒，保留已有自定义设置。超时提示显示 CLI 初始化、账号读取、额度读取等具体阶段。
- 保留本地／远程选择、状态栏左右切换、5 小时与周额度显示，以及明确的 CLI 账号来源。

验证：Windows 34 项、Linux 33 项（1 项 Windows 专用测试按平台跳过）、打包入口 9 项、两平台真实 VS Code 宿主及官方 npm Codex CLI `0.162.1` 的未登录冒烟通过。Windows 原生探针确认查询进程没有控制台。真实 ChatGPT 订阅额度及用户桌面仍需实机验收，详见 `TESTING.md`。

安装：下载 VSIX，在 VS Code 扩展视图选择“从 VSIX 安装”，随后执行“Developer: Reload Window / 重载窗口”，再刷新额度。若曾手动设置 20 秒超时，可将 `codexQuota.requestTimeoutSeconds` 改为 60 或 120。

VSIX 字节数：18522。SHA256：

```text
608b133e792eabd8e469b20b3d841ba633eb237c795f44f57f3e0e9d13223091
```
