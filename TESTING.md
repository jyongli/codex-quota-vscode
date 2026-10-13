# 验证记录

## 0.1.16

验证日期：2026-10-13。当前云环境为 Linux x64。

- `npm test`：75 项通过，3 项 Windows 专用测试按平台跳过。新增非相邻 npm／pnpm／Yarn 目录、CMD／BAT／PowerShell 目标解析、UTF-16 与安装目录变量、失效 PATH 项跳过、未知包装器拒绝执行，以及 CLI 安装探测失败后 IDE 来源继续查询。
- `npm run test:bundle`：25 项通过，加载实际打包入口，包含账号来源合并与安装失败状态恢复。
- 官方 npm CLI `0.162.1`：真实 registry 自动安装与复用、隔离未登录账号读取、配置数据库目录和启动失败诊断通过。
- 真实 Linux VS Code `1.95.3`：14 组断言通过，覆盖实际宿主、来源合并／选择、账号隔离、后台安装及已有 UI 设置。安装最终 VSIX 后，修正后的宿主测试再次通过。
- 最终 VSIX：12 个文件、1,161,822 字节，商店图标／简介／包身份、安装后入口与翻译字节检查通过，发布维护文档未包含在安装包内。SHA256：`d202d1975e462fca1318653672ee6cbdfdb20ee496d4c2ee331fe574cc480ecb`。

- [Windows／Linux CI 第 57 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38363863775)：通过（1 分 55 秒）。Windows 78 项单元、25 项打包入口及 15 组真实 VS Code 检查通过；Linux 75 项单元通过、3 项按平台跳过，真实宿主 14 组通过。

Windows 专用检查包含真实控制台可执行文件的 `GetConsoleWindow` 断言、包装器内容不执行、CLI／IDE 配置来源实际账号探测合并，以及默认未知包装器复用或安装备用 CLI；Windows VS Code 增加真实官方 npm CMD 入口与独立配置账号合并。首次 CI 的 Windows 失败发生在新增 VS Code 宿主步骤；修正新增断言的短路径／实际路径比较并补充公开失败诊断后通过。仍不读取实际订阅登录凭据，官方 IDE 内存账号与其他宿主的限制沿用前版。

## 0.1.15

验证日期：2026-10-11。当前云环境为 Linux x64。

- `npm test`：70 项通过，1 项 Windows 专用项按平台跳过。新增官方账号探测不查询额度、实际路径与账号双条件合并、继承目录与符号链接、Windows 路径大小写、身份未知时保留来源、旧 IDE 选择别名、首次自动选择、取消后不重复提示和忽略过期选择。
- `npm run test:bundle`：24 项通过，加载实际打包入口；包含同目录同账号自动合并、同目录不同账号隔离及自动／手动窗口共用。
- 官方 npm CLI `0.162.1`：真实 registry 自动安装与复用、隔离未登录账号读取、配置数据库目录和启动失败诊断通过。
- 真实 Linux VS Code `1.95.3`：14 组断言通过，新增相同配置目录与账号自动合并，以及无需执行选择命令的自动 Quick Pick。选中第二个账号后读取其独立额度，清除额外来源恢复单一账号。安装最终 VSIX 后，同样的 14 组断言再次通过；安装后入口、图标和翻译字节与测试包一致。
- 最终 VSIX：12 个文件，1,160,434 字节；商店图标／简介／JSON 与 XML 包身份校验通过。SHA256：`3c612ff05acf024f153bf1b2dd4b706e5293b60daa8d5d2c6b04ed6614d35c98`。
- [Windows／Linux CI 第 52 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38131389142)：通过（1 分 52 秒）。两端均通过单元、实际打包入口、官方 npm CLI、真实 VS Code 自动选择／合并和 VSIX 校验。
- [发布标签提交 CI 第 53 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38131562247)与 [GitHub Release 第 27 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38131562079)：通过。公开下载的 VSIX／SHA256 与冻结测试包完全一致，包身份及图标再次校验通过。

账号检测使用官方 `initialize`／`account/read`，不读取 `auth.json`。ChatGPT 身份比较依据接口返回的邮箱与计划；无邮箱、API Key、Bedrock 或探测失败不能确认身份，不进行合并。共享目录通过不同 CLI 返回不同账号的情形用隔离协议测试程序验证。官方 IDE 内存登录状态、插件内部其他 SSH 连接与不同宿主仍不在自动检测范围，真实登录与远程实机验收限制沿用前版。

## 0.1.14

验证日期：2026-10-11。当前云环境为 Linux x64。

- `npm test`：62 项通过，1 项 Windows 专用项按平台跳过。新增多来源等待选择／取消、偏好恢复与只读存储、账号隔离、取消旧查询、同宿主 IDE 配置来源、宿主与 WSL 排除及配置校验。
- `npm run test:bundle`：21 项通过，加载实际打包入口。
- 官方 npm CLI `0.162.1`：真实 registry 自动安装与复用、隔离未登录账号读取、配置数据库目录和启动失败诊断通过。
- 真实 Linux VS Code `1.95.3`：13 组断言通过，新增实际 Quick Pick 选择第二个账号来源；清除额外来源后自动恢复单一账号。只安装最终 VSIX 后，13 组断言再次通过。
- 最终 VSIX：12 个文件，1,158,313 字节；图标 PNG 为 1254×1254，已检查 PNG 标识／尺寸、简短介绍、JSON／XML 包身份和安装后入口／图标／翻译字节一致性。SHA256：`50907c2b55f76d191d4ca8ca0f5ed6f86136bcb74dda9f73f6ea5319dae88989`。

- [Windows／Linux CI 第 49 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38118030640)：通过（2 分 9 秒）。两端均通过单元、实际打包入口、官方 npm CLI、真实 VS Code 宿主和 VSIX 图标／介绍／身份校验。

- [发布提交 CI 第 50 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38118176489)和 [GitHub Release 第 26 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38118176323)：通过。实际下载公开 VSIX 与 SHA256 文件，字节／校验值和冻结测试包一致；图标与清单再次验证通过。

已核查官方 IDE 安装包 `openai.chatgpt@26.51007.21434` 的程序路径、同宿主配置目录和 WSL 分支，并阅读公开认证／配置文档。IDE 来源的账号隔离测试使用协议测试程序与两个独立目录；不等于实际官方 IDE 订阅登录验收。只能读取当前宿主的共享配置账号，不能保证等于官方 IDE 内存会话或其他内部 SSH 连接账号。其他宿主与 Windows 内 WSL 来源不以本机账号代替。同一账号额度共享。临时公开接口核查工作流已删除；既有公网 IP、实际 SSH／WSL／容器及 macOS／ARM64 实测限制仍适用。

## 0.1.13

验证日期：2026-10-11。当前云环境为 Linux x64。

- `npm test`：57 项通过，1 项 Windows 原生测试按平台跳过。设置菜单定位 `ujyong.codex-quota-monitor-ujyong`。
- `npm run test:bundle`：18 项通过，使用实际打包入口。
- 真实 Linux VS Code `1.95.3`：12 组断言通过，包括新扩展 ID 的发现、清单名称／发布者、菜单打开设置、额度、双语／位置和后台 CLI 安装。
- 最终 VSIX：11 个文件、39,799 字节；包名 `codex-quota-monitor-ujyong`、发布者 `ujyong`、版本 `0.1.13` 在 JSON／XML 清单中一致。ZIP 与安装后入口字节检查通过；只安装最终 VSIX 后，真实 VS Code 的 12 组断言再次通过。
- [Windows／Linux CI 第 41 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38110569682)：通过。两端均通过单元、打包入口、官方 CLI、实际 VS Code 宿主和包身份检查。Linux 的官方 `vsce search` 查询成功，未发现其他发布者使用完整名称 `codex-quota-monitor-ujyong`。
- [标签提交 CI 第 42 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38110704063)与 [GitHub Release 第 25 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38110704496)：通过。公开下载的 VSIX／校验文件与冻结测试包一致，SHA256 为 `414b2a4ad41c1b8327dfbea5f2839e2a4823fc353bdb1c73cfb41678c409b7fe`。发布脚本从目标标签清单读取包名，实际定位新的文件名并验证成功。

当前云环境直接访问商店 API 返回代理 403，公开查询已由 GitHub Linux CI 补充。查询不等于名称预留，最终以上传校验为准；GitHub Release 和 VSIX 验证也不等于 Marketplace 上架成功。查询网络故障只记录未确认，不使构建因此失败。旧扩展 ID 需卸载，设置与 Codex CLI 登录仍可使用。运行协议和宿主行为不变，其他实机验证限制沿用前版。

## 0.1.12

验证日期：2026-10-11。当前云环境为 Linux x64。

- `npm test`：57 项通过，1 项 Windows 原生测试按平台跳过；菜单使用新扩展 ID 定位原生设置。
- `npm run test:bundle`：18 项通过，加载实际打包入口。
- 真实 Linux VS Code `1.95.3`：12 组断言通过，按 `ujyong.codex-quota-vscode` 发现扩展，确认发布者为 `ujyong`；包括实际菜单打开设置、双语／位置即时更新、CLI 查询和后台自动安装。
- 最终 VSIX：11 个文件、39,508 字节；`package.json` 与 `extension.vsixmanifest` 中的发布者均为 `ujyong`，版本均为 `0.1.12`。ZIP 和已安装入口字节一致性检查通过。独立安装最终 VSIX 后，真实 VS Code 宿主的 12 组断言再次通过。
- [Windows／Linux CI 第 38 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38109090060)：通过。两端均通过单元测试、打包入口、官方 CLI 和实际 VS Code 宿主检查，以及新增的 VSIX 发布者与两份清单身份校验。
- [标签提交 CI 第 39 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38109244825)与 [GitHub Release 第 24 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38109244637)：通过。实际下载公开 Release 的 VSIX 与 SHA256 文件，确认与冻结测试包字节一致；SHA256 为 `1a01566ef6d3fe6acb48046ef4ed0f343316732b425f9239e975c19b3f6a5308`。

本版更正 Marketplace 发布者，不改变 CLI 查询协议和按安装位置运行的规则。旧 `jyongli.codex-quota-vscode` 是不同扩展 ID，升级时需卸载旧插件；账号凭据无需迁移。商店网页上传尚需实际账号提交，打包验证不能代替 Marketplace 上架确认。真实 SSH／WSL／容器、macOS／ARM64、真实订阅账号和公网 IP 联网验证范围沿用之前记录。

## 0.1.11

验证日期：2026-10-11。当前云环境为 Linux x64。

- `npm test`：57 项通过，1 项 Windows 原生测试按平台跳过。新增真实 npm 测试进程，覆盖已有 CLI、不覆盖自定义路径、缺少 npm、关闭自动下载、后台安装、跨窗口锁、缓存复用、安装失败与残缺包、超时、取消和进程／锁清理。扩展用例覆盖本地／远程安装宿主、双语安装状态、无重载／设置改写、失败重试与未登录指引。
- `npm run test:bundle`：18 项通过，加载实际打包入口。
- 真实 npm 自动安装：从官方 registry 自动安装 `@openai/codex@0.162.1`，复用安装结果，实际 app-server 握手与隔离未登录账号读取通过；既有自定义数据库目录和无效配置目录诊断检查通过。
- 真实 Linux VS Code `1.95.3`：12 组断言通过，包含 Electron 扩展宿主自动启动后台 npm、缺少默认 CLI 时安装并复用、沿用同一配置目录，以及既有菜单、设置、来源、IP 和诊断行为。
- 最终 VSIX：11 个文件，清单、机器级自动安装设置、ZIP 与入口字节校验通过。只安装最终 VSIX 后，实际 Linux VS Code 宿主的 12 组断言全部通过。
- [Windows／Linux CI 第 32 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38105442863)：通过。Windows 58 项单元测试全部通过，Linux 57 项通过并跳过 Windows 专用项；两端均通过 18 项打包入口测试、真实 npm 自动安装与 CLI 原生检查、12 组实际 VS Code 宿主断言及打包。

实际 VS Code 自动安装流程使用离线 npm 协议测试进程，官方仓库下载与真实 CLI 启动另由原生检查验证；CI 同时执行这两种验证。Windows 发布任务首次出现一次临时 SQLite 文件清理 `EBUSY`：该任务的 CLI 功能断言已先全部通过；原失败任务重跑后通过。已为测试临时目录清理增加有限重试，并移除主分支发布触发，只按标签／手动发布，避免同一版本重复任务。诊断用临时工作流已删除。安装完成不等于 ChatGPT 已登录；未登录状态按接口真实显示。没有读取现有凭据或实际订阅账号。真实 SSH／WSL／容器连接及 macOS／ARM64 实机验证尚未进行。

## 0.1.10

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：50 项通过，1 项 Windows 原生测试按平台跳过。既有扩展行为用例改为原生语言／位置设置，验证工作区覆盖、即时重译、保留快照且不重复查询；旧菜单语言偏好不覆盖设置。原来的菜单保存降级功能已移除，其专用测试同步移除。
- `npm run test:bundle`：16 项通过，加载实际运行入口；验证四项菜单、定位插件设置、移除旧切换命令及既有宿主查询行为。
- 真实 Linux VS Code `1.95.3`：11 组断言通过。实际打开四项菜单并选择第 4 项“打开设置”；原生设置改变语言／位置后立即生效，保留当前额度与查询时间，工作区设置优先于用户设置。
- 最终 VSIX：11 个文件，版本、清单、四项命令及入口字节已校验。只安装最终 VSIX 后，真实 Linux VS Code 宿主的 11 组断言全部通过，包含官方 npm CLI `0.162.1` 的隔离未登录账号检查。

- [Windows／Linux CI 第 29 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38066237727)：通过。Windows 51 项单元测试全部通过，Linux 50 项通过并跳过 Windows 专用项；两端均通过 16 项打包入口测试、官方 CLI 原生检查、11 组实际 VS Code 宿主断言及打包。

位置和语言由 VS Code 原生设置编辑器管理；旧菜单偏好已不再读取，也不写入插件存储。实际远程连接、公网 IP 服务联网和真实订阅账号的验证限制沿用 0.1.9。

## 0.1.9

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：53 项通过，1 项 Windows 原生测试按平台跳过。覆盖同一个插件在本地／SSH／WSL／容器／Codespaces 模拟宿主中读取所在机器的独立 CLI 账号、旧环境选择失效、宿主覆盖不被改写、旧远程路径兼容和新设置优先、失败诊断、双语与公网 IP。
- `npm run test:bundle`：19 项通过，加载最终主包运行入口；不加载、安装或路由到第二扩展。
- 真实 Linux VS Code `1.95.3`：11 组断言通过，包括单个 workspace 扩展的本地执行、语言菜单、无效 JSON 设置下的语言切换、IP 缓存、工作区覆盖下的位置切换、额度与错误状态、忽略旧远程路径，以及官方 npm CLI `0.162.1` 在隔离未登录目录中的启动。
- 最终 VSIX：11 个文件，清单版本与 `extensionKind: ["workspace"]`、机器级路径设置、无内置第二扩展及实际入口字节均已校验。只安装该 VSIX 后，真实 Linux VS Code 宿主的 11 组断言全部通过。

- [Windows／Linux CI 第 26 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38065067932)：通过。Windows 54 项单元测试全部通过，Linux 53 项通过并跳过 Windows 专用项；两个平台均通过 19 项打包入口测试、官方 CLI 原生检查、11 组真实 VS Code 宿主断言及单包打包。

实际 SSH／WSL／容器连接尚未实机验收；模拟宿主测试使用真实协议子进程和独立虚构账号，不能替代真实远程安装验收。公网 IP 测试使用模拟 HTTPS 响应；真实订阅账号与该服务真实联网的验证限制沿用 0.1.6。VS Code 原生安装／升级是否提示重新加载由 VS Code 决定，插件不会主动发出重载或自动安装组件。

## 0.1.8

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：69 项通过，1 项 Windows 原生测试按平台跳过。新增语言设置不可写时的即时切换与偏好持久化、JSON／未保存修改分类、工作区偏好隔离、后续正常保存及手动配置优先、“跟随 VS Code”恢复，以及设置和插件存储均失败时的窗口内切换与未持久化提示。
- `npm run test:bundle`：25 项通过，加载主包实际运行入口。
- 真实 Linux VS Code `1.95.3` 扩展宿主：11 组断言通过。语言测试实际打开菜单、选择条目并确认；工作区设置文件加入无效 JSON 后，仍切换到 English，原文件字节保持完整，额度与查询时间不变；修复设置后再次通过菜单恢复中文。
- 最终单个 VSIX 的清单、版本、ZIP 及入口校验通过；只安装主包后，真实 Linux VS Code 宿主的 11 组断言全部通过，直接加载已安装入口及内置组件。
- [Windows／Linux CI 第 23 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38056871427)：通过。Windows 70 项单元测试全部通过，Linux 69 项通过并跳过 Windows 专用项；两个平台均通过 25 项打包入口测试、官方 CLI 原生检查、11 组真实 VS Code 宿主断言及单包打包。

设置保存失败时使用 VS Code 的全局／工作区插件存储，不改写损坏或未保存的设置文件。偏好在重新激活后恢复，但不会覆盖后来已更改的语言配置。原始编辑器错误不进入插件提示或诊断，只记录固定类别。真实 SSH／WSL／容器及真实订阅账号的验收范围沿用 0.1.7。

## 0.1.7

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：65 项通过，1 项 Windows 原生测试按平台跳过。新增首次远程查询自动安装、兼容组件复用、安装失败分类、并发安装合并、等待超时、取消等待和晚到安装隔离。
- `npm run test:bundle`：21 项通过，加载实际打包入口；验证从仅有主插件开始，安装内置组件后读取远程账号，以及安装期间切回本地不受晚到结果影响。
- 官方 npm CLI `0.162.1`：隔离未登录配置中的原生握手、账号读取与启动失败诊断通过。
- 真实 Linux VS Code `1.95.3` 扩展宿主：10 组断言通过。仅将主插件作为开发扩展加载，在全新扩展目录中通过 VS Code 的内置安装命令安装包内组件，立即激活并读取协议测试账号；没有预装组件，也没有重启窗口。
- 最终单个 VSIX 的 ZIP、清单、版本、入口及翻译校验通过：主包 12 个文件，包含 `bundled/remote.vsix`；内置组件 9 个文件，分别使用 UI／Workspace 宿主。
- 在独立目录只安装最终主 VSIX 后，真实 Linux VS Code 宿主的 10 组断言全部通过，直接加载已安装入口与内置安装包。
- [Windows／Linux CI 第 20 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38044154597)：通过。Windows 66 项单元测试全部通过，Linux 65 项通过并跳过 Windows 专用项；两个平台均通过 21 项打包入口测试、官方 CLI 原生检查、10 组真实 VS Code 宿主断言及单个主 VSIX 打包。

已有协议兼容组件直接复用，不触发安装或更新；用户取消只停止查询等待，已经开始的 VS Code 安装可在后台完成。安装后使用独立就绪命令触发组件激活，该命令不运行 CLI。真实宿主测试验证本地窗口中的冷安装和两个组件的命令通信；远程路由与账号隔离使用模拟宿主，真实 SSH / WSL / 容器连接尚未实机验收。公网 IP 与真实订阅账号的验证范围沿用 0.1.6 记录。

## 0.1.6

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：56 项通过，1 项 Windows 原生测试按平台跳过。新增自动／显式语言选择、工作区设置覆盖、切换语言保留快照与重译缓存错误、远程错误 JSON 往返，以及公网 IP 地址校验、成功／失败缓存、过期数据清除、超时与取消。
- `npm run test:bundle`：19 项通过，加载主插件及远程组件的实际打包入口。
- 真实 Linux VS Code `1.95.3` 扩展宿主：9 组断言通过。包括语言即时切换保留额度、公网 IP 显示／缓存／关闭、远程组件网络取址失败仍返回额度，以及官方 npm CLI `0.162.1` 在隔离未登录目录中的真实启动。
- [Windows／Linux CI 第 18 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38041568764)：通过。Windows 57 项单元测试全部通过，Linux 56 项通过并跳过 Windows 专用项；两个平台均通过 19 项打包入口测试、官方 CLI 原生冒烟、9 组真实 VS Code 宿主断言及两个 VSIX 打包。
- 最终两个 VSIX 的 ZIP、版本、入口字节和清单翻译校验通过：主插件 11 个文件，远程组件 9 个文件；包含英文及中文清单资源。
- 在独立目录安装两个最终 VSIX 后，真实 Linux VS Code 宿主的 9 组断言全部通过，直接加载已安装入口。

真实宿主测试在启动前通过正常用户设置关闭外网取址，随后用独立模拟 HTTP 响应测试成功与失败路径；没有生产代码测试开关。当前云环境到 ipify 的 HTTPS 连接被网络策略拒绝（CONNECT 403），因此不能将这些结果称为该服务的真实联网成功验收。公网 IP 请求不包含账号或凭据，失败不影响额度。真实 SSH / WSL / 容器连接及真实订阅账号仍未实机验收。

## 0.1.5

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：44 项通过，1 项 Windows 原生测试按平台跳过。两个模拟宿主现在共享同一个合并配置对象，分别通过本地与远程设置键读取各自账号，覆盖无需重载切换、取消、错误宿主、组件缺失和工作区覆盖下的位置更新。
- `npm run test:bundle`：15 项通过，加载两个实际打包入口。
- 真实 VS Code `1.95.3` Linux 扩展宿主：7 组断言通过。同一窗口配置两个独立账号目录，查询组件返回远程测试目录的账号，主插件仍返回本地测试账号；旧协议客户端被拒绝。包括工作区位置覆盖与官方 npm CLI `0.162.1` 启动。
- [Windows／Linux CI 第 16 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38038980495)：通过。Windows 45 项单元测试全部通过；两个平台均通过 15 项打包入口测试、官方 npm CLI `0.162.1` 原生冒烟、7 组真实 VS Code 宿主断言及两个 VSIX 的打包。
- 两个最终 VSIX 的 ZIP／清单校验通过：主插件 7 个文件、远程组件 6 个文件；版本一致，入口与实际安装目录一致。
- 在独立目录安装两个最终 VSIX 后，真实 Linux VS Code 宿主测试通过，7 组断言；确认账号目录隔离、位置切换和官方 CLI 启动使用最终包入口。

本地 CLI 与配置目录使用 application 范围，远程用户设置不能覆盖；远程组件使用独立的机器级设置键。此设计依据 VS Code 的配置行为：两个扩展宿主都收到合并后的用户配置，而远程配置不接受 application 设置。原生测试使用独立临时未登录配置；实际 SSH / WSL / 容器连接及真实订阅账号尚未实机验收。

CI 增加 15 分钟任务时限、固定版本 VS Code 下载缓存和同分支构建并发控制。发布任务完成 Windows／Linux 检查、校验并发布 VSIX 后，可取消当前发布提交的祖先中仍运行的旧主分支 CI；不会取消当前提交或更新提交的检查。

## 0.1.4

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：44 项通过，1 项 Windows 原生测试按平台跳过。覆盖工作区设置优先级、菜单点击左右切换、双组件查询／取消协议、不同宿主的 CLI 配置与账号隔离、缺失或错误宿主组件、环境切换取消真实子进程与晚到响应，以及旧宿主选择的迁移。
- `npm run test:bundle`：15 项通过，同时加载主插件与远程组件的实际打包入口。
- 真实 VS Code `1.95.3` Linux 扩展宿主：7 组断言通过，包含工作区覆盖下的位置切换、两个扩展通过真实 VS Code 命令通信，以及官方 npm CLI `0.162.1` 启动。
- [Windows／Linux CI 第 13 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38037818868)：通过。Windows 45 项单元测试全部通过；两个平台均通过 15 项打包入口测试、官方 CLI 原生冒烟、7 组真实 VS Code 宿主断言及两个 VSIX 的打包。
- 在独立扩展目录安装两个最终 VSIX，实际安装后的 Linux VS Code 宿主测试通过，7 组断言。最终发布包的运行入口与已安装实测的入口字节一致。
- 两个 VSIX 的 ZIP／清单检查通过：主插件 7 个文件、查询组件 6 个文件，版本一致，分别固定为 UI／Workspace 宿主，没有测试、开发依赖或凭据。

远程路由测试使用两个独立的模拟 VS Code 宿主，各自执行真实协议测试子进程；真实 VS Code 测试验证两个扩展的命令通信与序列化，但当前环境没有实际 SSH / WSL / 容器远程连接，不能据此声称已完成这些宿主的实机验收。CLI 原生测试使用独立临时未登录配置，不读取真实凭据。旧版强制主插件在远程运行的用户首次升级可能需要重新加载扩展，以后的查询环境切换不要求重载窗口。

## 0.1.3

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：37 项通过，1 项 Windows 原生测试按平台跳过。新增网卡 IP 的回环过滤、IPv4 优先、多网卡去重、数字 family、IPv6 和无地址处理；更新扩展测试，验证精简悬浮提示、专用账号来源菜单及刷新间隔设置变化。
- `npm run test:bundle`：10 项通过，加载实际打包入口。
- 真实 VS Code `1.95.3` Linux 扩展宿主：6 组断言通过，包含宿主 IP、刷新间隔、红框说明移出悬浮提示，以及官方 npm CLI `0.162.1` 启动。
- [Windows／Linux CI 第 11 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38035653261)：通过。Windows 38 项测试全部通过；两个平台均通过 10 项打包入口测试、官方 CLI 原生冒烟、6 组真实 VS Code 宿主断言及 VSIX 打包。
- 最终 0.1.3 VSIX ZIP／清单校验通过：7 个必要文件，运行入口与已验证入口字节一致。
- 在独立扩展目录安装最终 0.1.3 VSIX 后，真实 Linux VS Code 宿主测试通过，6 组断言。

IP 获取只读取实际执行宿主的网卡，不请求公网 IP 服务。多网卡与 IPv6 情形使用独立网卡数据测试；实际远程连接中的网卡与宿主迁移仍需实机验证。CLI 测试使用临时未登录配置，未读取真实凭据。

## 0.1.2

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：35 项通过，1 项 Windows 原生测试按平台跳过。新增提前退出的阶段／退出码／分类、敏感内容过滤，以及错误弹窗／诊断命令／重复提示行为验证。
- `npm run test:bundle`：10 项通过，加载实际打包入口。
- 官方 npm Codex CLI `0.162.1` 与 `0.116.0`：真实握手及未登录账号读取通过；覆盖空格／中文配置路径、自定义 SQLite 目录，以及无效配置目录导致提前退出时的诊断。
- 真实 VS Code `1.95.3` Linux 扩展宿主：6 组断言通过，包括错误诊断命令和实际启动官方 npm CLI `0.162.1`。账号使用独立临时未登录配置，无真实凭据。
- [Windows／Linux CI 第 9 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38034413188)：通过。Windows 36 项测试全部通过，含原生控制台探针及原生进程不继承 Electron Node 模式的断言；两个平台均通过 10 项打包入口测试、原生 CLI 冒烟、6 组真实 VS Code 宿主断言及 VSIX 打包。
- 最终 0.1.2 VSIX ZIP／清单校验：通过；7 个必要文件，包含诊断命令，入口与已实测入口字节相同。
- 将 0.1.2 VSIX 安装到独立扩展目录后运行真实 Linux VS Code 宿主：通过，6 组断言，包含官方 CLI 启动。

此前 Windows CI 的短路径／规范路径比较已在 0.1.1 修正。本次新增诊断测试中的 Windows 路径 JSON 转义断言已改为解析 JSON 后比较字段，保留了有效的来源断言。

用户机器上的具体提前退出原因尚未取得退出码。本版移除 CLI 数据目录覆盖、显式使用 stdio 并改善诊断；以上测试不代表已验证用户的 ChatGPT 登录或真实在线额度。实际远程宿主、ARM64 原生执行及用户桌面上的 Windows Terminal 仍需实机验证。

## 0.1.1

验证日期：2026-10-10。当前云环境为 Linux x64。

- `npm test`：33 项通过，1 项 Windows 原生窗口测试按平台跳过；覆盖 Windows x64／ARM64、官方 npm 平台依赖／旧 vendor、新旧二进制目录、缺少依赖与超时阶段。
- `npm run test:bundle`：9 项通过，加载实际打包入口。
- 官方 npm Codex CLI `0.162.1`：真实初始化与账号读取通过，使用临时未登录配置，不读取实际凭据。
- 真实 VS Code `1.95.3` Linux 扩展宿主：激活／账号来源、位置切换、仅周额度、API Key 状态 4 组断言通过。
- [Windows／Linux CI 第 6 次运行](https://github.com/jyongli/codex-quota-vscode/actions/runs/38032519526)：通过。Windows 34 项测试全部通过，含原生控制台探针（调用 `GetConsoleWindow`，确认查询进程没有控制台）；打包入口 9 项、真实 VS Code 宿主 4 组及官方 npm CLI `0.162.1` 的未登录冒烟均通过。Release 必须等待 Windows 检查通过。
- VSIX 安装及安装后 Linux 宿主测试：通过，4 组断言。最终发布包的入口与已实测的安装入口字节一致，ZIP／清单校验通过，版本为 `0.1.1`。

窗口探针使用 Windows 自带 .NET Framework C# 编译器构建独立控制台程序，不访问凭据。真实 ChatGPT 订阅额度、用户桌面上的 Windows Terminal、ARM64 原生执行及实际远程机器仍需实机验收。

## 0.1.0

验证日期：2026-10-10。环境：Linux x64、Node.js 24.19.0、npm 11.9.0。

| 检查 | 结果 | 实际范围 |
| --- | --- | --- |
| `npm test` | 30/30 通过，0 跳过 | 额度／账号解析、真实子进程 JSONL 往返、取消／超时／错误、模拟 VS Code API 的宿主与状态栏行为 |
| `npm run test:bundle` | 9/9 通过，0 跳过 | 同样的扩展行为测试加载实际 `dist/extension.js` |
| 官方 CLI 0.116.0 原生冒烟 | 通过 | 官方 npm 包；新建未登录配置目录；真实 `initialize` / `account/read`，账号为未登录，无虚构额度 |
| 预装 CLI 0.159.0-alpha.3 原生冒烟 | 通过 | 新建未登录配置目录，真实握手与账号读取 |
| 真实 VS Code 1.95.3 宿主 | 通过，4 组断言 | Xvfb；实际 Node 扩展宿主；真实子进程协议测试账号；激活与账号来源、状态栏切换、仅周额度、API Key 状态 |
| `npm run package` | 通过 | 生成 0.1.0 VSIX，无发布动作 |
| VSIX ZIP 与清单检查 | 通过 | ZIP 校验、7 个必要文件、入口存在、命令／宿主清单正确，无测试、node_modules 或凭据 |
| VSIX 安装及安装后宿主测试 | 通过，4 组断言 | 官方 VS Code CLI 成功安装 `jyongli.codex-quota-vscode@0.1.0`；测试宿主直接加载该安装目录中的 VSIX 入口 |

原生 CLI 测试使用独立未登录配置，不读取真实账号凭据。模拟协议账号的邮箱均为 `example.test`。宿主测试额度来自协议测试进程，不能据此声称已查询过真实订阅账号。

VS Code 自动下载地址在本环境被网络策略拒绝。本次使用允许访问的微软官方 Debian 软件源下载固定 1.95.3：验证 Microsoft Release 签名、索引 SHA256、DEB SHA256 后提取到 `/workspace/scratch/codex-quota-test-tools`，未修改系统安装。Xvfb 同样由已验证的 Debian 官方签名与 SHA256 取得。测试进程已结束。

预装 CLI 默认的 `CODEX_HOME` 是平台只读目录，启动 app-server 时无法写入其内部状态。因此原生测试使用临时未登录目录，未更改平台凭据。0.1.0 中的辅助 SQLite／日志目录使用 VS Code 的全局存储；0.1.2 起沿用 CLI 自身配置的目录。Codex 本身仍需其正常的配置目录写权限。

以下范围未实测：

- 已登录 ChatGPT 账号向官方后端查询真实剩余额度；本次仅验证临时未登录配置，未使用用户的 ChatGPT 登录状态。
- 在真实 SSH / WSL / Dev Container / Codespaces 中，重载后跨宿主切换与各自账号读取。已验证宿主判断、配置保留、待重载阻止旧端查询，以及远程分支的模拟行为。
- Windows / macOS 的原生进程启动与系统凭据存储。Windows npm shim 的解析已通过逻辑测试。

以上记录是发布前完成的本机验证。仓库包含真实 VS Code 宿主测试入口与 CI／Release 工作流，在线运行结果以 GitHub Actions 为准。真实远程验收步骤见 README 的“本地／远程选择”。
