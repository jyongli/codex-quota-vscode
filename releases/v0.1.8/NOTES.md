Codex Quota 是一个在 VS Code 状态栏查看 Codex CLI 剩余额度的插件。本版修复选择语言时因无法保存设置而切换失败的问题。

- 设置正常时，继续保存到当前生效的用户／工作区配置，语言立即切换。
- 设置含 JSON 错误、未保存修改或不可写时，语言选择保存为插件偏好；额度和查询时间保持不变，不覆盖原设置文件。
- 设置和插件存储都不能写入时，仍切换当前窗口语言，并明确提示关闭窗口后不会保留。
- 保存错误提供固定的 JSON、未保存修改、权限／只读或策略类别，并提供诊断入口，不显示原始错误内容。
- 保留单个 VSIX 的内置远程支持、无需重载的环境切换、状态栏左右切换及内网／公网 IP。

安装 `codex-quota-vscode-0.1.8.vsix`，然后从状态栏菜单选择“选择显示语言”。正常中英文及“跟随 VS Code”切换不重新查询 CLI，也不重载窗口。

Windows／Linux CI 已通过：Windows 70 项单元测试、两个平台各 25 项打包入口测试、官方 CLI 原生检查、11 组真实 VS Code 宿主断言及单包打包。最终主 VSIX 安装后的 Linux 宿主 11 组断言也已通过，包含实际语言菜单操作和无效 JSON 设置文件。真实 SSH／WSL／容器与订阅账号在线额度仍未实机验收。

验证运行：https://github.com/jyongli/codex-quota-vscode/actions/runs/38056871427

English: Language selection now continues when VS Code settings cannot be saved, using an extension preference. If both settings and extension storage are unavailable, the choice applies to the current window with a clear notice that it cannot persist. Quota remains intact; no CLI re-query or window reload is required.

安装包：55634 字节；SHA256：`da54e4d67b092efdad9d1507e3c122f1151124b33613aecf04fb04b761c7baa9`。
