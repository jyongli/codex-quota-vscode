# Codex Quota for VS Code

[中文](README.md) | English

Codex Quota is a **Visual Studio Code extension** that displays the remaining quota for the extension host’s currently signed-in **Codex CLI ChatGPT account**.

- Both quota windows available: `Codex [Local] 5h 75% · Week 60%`.
- Weekly window only: `Codex [Local] Week 60%`.
- Install the same VSIX locally or remotely; query that machine’s CLI and signed-in account.
- Actual configuration directories and sign-ins are detected automatically; equivalent sources merge, one source displays directly, and distinct sources prompt for selection. Configure status bar side and language in VS Code Settings.
- The tooltip shows the extension host’s network interface IP, public outbound IP, account, quota resets, last check and refresh interval.

## Installation

Use desktop VS Code 1.95+. Existing official Codex CLI installations are reused. If the default `codex` command is missing, the extension automatically installs the official npm package on that host; this requires npm and network access. Codex CLI 0.116.0+ is recommended.

Download version 0.1.15 from [GitHub Releases](https://github.com/jyongli/codex-quota-vscode/releases):

- [Codex Quota VSIX](https://github.com/jyongli/codex-quota-vscode/releases/download/v0.1.15/codex-quota-monitor-ujyong-0.1.15.vsix)

Install using **Extensions → … → Install from VSIX**. In a local window install under **Local**. In an SSH / WSL / Dev Container / desktop Codespaces window install the **same extension, same VSIX** on that remote host using the remote Extensions group or **Install from VSIX**. A missing CLI is automatically installed on that machine; sign in there with ChatGPT.

The extension name is **`codex-quota-monitor-ujyong`** because the original `codex-quota-vscode` name is already taken in the Marketplace. The Marketplace publisher is **`ujyong`**, with extension ID **`ujyong.codex-quota-monitor-ujyong`**. If you installed the previous **`jyongli.codex-quota-vscode`** or **`ujyong.codex-quota-vscode`** ID, uninstall that copy locally and on the relevant remote hosts before installing this version. VS Code treats these IDs as different extensions; keeping both active creates duplicate status items. Existing `codexQuota.*` settings and Codex CLI sign-in are preserved.

The extension uses `extensionKind: ["workspace"]`: local windows read the local CLI, account and IP; remote windows read the remote host’s CLI, account and IP. When installed on both sides, VS Code runs one instance in the active workspace host, with one quota status item. A remote window requires a remote installation; a local-only copy does not query locally from that remote window. Failed remote queries never fall back to a local account. The extension does not request window reloads or install companion extensions; VS Code controls whether initial installation / upgrades require activation or an extension reload.

The status bar shows `[Local]` / `[Remote]`, the tooltip shows the machine’s IP, and **View account and quota source** includes the actual host type and paths. **Developer: Show Running Extensions** can verify its location.

Upgrading: the manual environment selector and `codexQuota.executionEnvironment` are removed. The old **Codex Quota Remote** companion can be uninstalled. Remove any custom `remote.extensionKind` override for this extension to apply the new workspace-host model; the extension does not rewrite host overrides. Legacy remote path settings remain a fallback until the new unified settings are configured.

## Sources and multiple environments

Official `initialize` / `account/read` first detect actual `.codex` directories and sign-ins, without reading credential files or querying quota before selection. Sources merge only when **both the actual directory and account match**. Account comparison uses the returned email and plan; matching signed-out states may also merge. Inherited `CODEX_HOME`, explicit paths and symlinks resolve to actual directories, with case-insensitive Windows path comparison. Unknown identities, API keys and Bedrock remain separate when identity cannot be confirmed.

One resulting source displays automatically. Multiple distinct sources keep a valid saved choice, or automatically open **Choose quota source / environment** once with detected paths and accounts. Cancelling preserves the current state, and polling does not reopen the picker; its menu remains available for choosing later. Switching cancels the previous query and clears its numbers without reloading or editing settings. Saved CLI / IDE choices remain compatible after merging. Only the source ID is stored; read-only preferences do not prevent the current switch.

The default source is this host's **CLI**. When the official `openai.chatgpt` extension is installed in the same host and its native/custom CLI is accessible, **VS Code Codex (configuration account)** is also detected. It queries the official extension's CLI against this host's `CODEX_HOME` or `~/.codex`, without borrowing a CLI-specific `codexQuota.codexHome`. A matching directory and account merge into **CLI / VS Code Codex**; distinct sources stay selectable and their quota is read after selection. **View account and quota source** identifies actual paths and why sources merged.

**CLI and IDE share quota for the same account.** Separate sources are not independent quota pools. The IDE source represents the account in the shared configuration directory; it cannot guarantee the account of an in-memory IDE session or another internal SSH connection. No independently callable account/quota API for other extensions has been confirmed in the official extension.

For multiple Codex configuration accounts on this host, configure local/remote user settings:

```json
{
  "codexQuota.environments": [
    { "name": "Work", "codexHome": "~/codex-work" },
    { "name": "Personal", "codexHome": "~/codex-personal", "cliPath": "/absolute/path/to/codex" }
  ]
}
```

Use unique names and absolute or `~/` directories on **this extension's host**. The optional CLI path inherits this host's CLI setting when omitted. Codex manages sign-in; do not put credentials in these settings.

Discovery covers accessible sources on the current host. It does not scan other machines or read their credential files. An IDE in a different host, WSL launched from Windows, or another SSH connection inside the IDE is not labelled with this host's CLI account. Install this extension in the relevant host to query there. Source selection does not make one extension instance run simultaneously in local and remote hosts.

## Automatic CLI installation

The extension checks the CLI setting and PATH in its actual host. Existing CLI installations take priority, followed by a cached managed installation. If the default `codex` command is missing, it installs `@openai/codex@latest` from `https://registry.npmjs.org` into VS Code’s extension global storage on that machine. Invalid custom commands or paths keep their errors and are never replaced.

The npm JavaScript entry runs in the background with hidden Windows processes, without executing npm.cmd through a shell. Installation does not require administrator access or change PATH or a global CLI. Scripts are disabled and official optional platform packages are included; package identity, entry and native binary are checked before use. Concurrent refreshes and windows share an installation lock; partial installations are cleaned up. There is no window reload.

The status bar shows **Installing Codex CLI**. Installation has a separate 180-second timeout and reports missing npm, network/proxy/certificate failures, permissions and incomplete packages. Refresh to retry. Disposal or relevant setting changes cancel installation. If npm is absent, install Node.js and npm on that host and restart VS Code. `codexQuota.autoInstallCli: false` disables downloads while allowing an existing managed installation to be reused.

Installation preserves that host’s `CODEX_HOME` / `codexQuota.codexHome` and credential store. Existing sign-in is reused; a signed-out account stays **Signed out**. Run `npx @openai/codex login` in that host’s terminal and refresh; set the same `CODEX_HOME` when using a custom directory. The extension does not log in, read or migrate credentials. **View account and quota source** shows the actual CLI and configuration paths.

## Language and status bar settings

Click the status bar → **Open settings** to open Codex Quota’s settings. For one source, the menu contains **Refresh quota**, **View account and quota source**, **View diagnostic log**, and **Open settings**. Multiple sources add **Choose quota source / environment**.

Choose **Language**: **Follow VS Code** (`auto`), **中文** (`zh-CN`), or **English** (`en`). Choose **Status Bar Position**: **Left** (`left`) or **Right** (`right`). You can also edit user / workspace settings:

```json
{
  "codexQuota.language": "en",
  "codexQuota.statusBarPosition": "right"
}
```

Changes apply immediately and preserve the current quota snapshot and check time without restarting queries or reloading the window. Workspace settings take priority over user settings; edit the workspace value when an override exists. Automatic language uses Chinese for Chinese VS Code locales and English otherwise.

VS Code Settings is the source of truth. Preferences saved by the old language menu no longer override it. VS Code’s native settings editor handles saving; fix invalid JSON or file permissions before saving if necessary. Command palette titles and native settings labels follow VS Code’s interface language, while the extension language setting controls runtime UI. Account emails, addresses and paths remain unchanged.

## Host addresses

**IP address** lists non-loopback addresses from the machine performing the query, preferring IPv4. **Public IP** is retrieved by that same machine from `https://api64.ipify.org` over HTTPS and may be IPv4 or IPv6. Local mode uses the local machine; remote mode uses the remote host. The request contains no account information or credentials. The result reflects the outbound route used by the HTTPS request, including any relevant VPN or proxy configuration.

Public IP results are cached in memory for five minutes per host. Requests time out independently after three seconds; unavailable addresses show `Unavailable` while quota querying continues. Failures are cached for 30 seconds. Set `codexQuota.showPublicIp` to `false` to hide the line and stop public IP requests.

## Account source and queries

Queries use the official `codex app-server --listen stdio://` protocol: initialize, `account/read`, `account/rateLimits/read` for ChatGPT accounts, then a second account read to avoid mixing accounts if login changes. The account comes from Codex CLI on the extension host, independently of VS Code’s GitHub login. The extension does not read `auth.json`, decode JWTs or handle login credentials itself.

API Key, Bedrock and signed-out states are identified explicitly. Remaining percentages are `max(0, 100 - usedPercent)`; windows are identified by their 300 / 10080 minute durations. `—` indicates an unknown window. Failures clear previous quota and provide a diagnostic action. Raw upstream errors and stderr are excluded from extension UI and logs. CLI processes run in the background using pipes, `shell: false` and `windowsHide: true`; official Windows npm entries resolve directly to their installed native executable.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `codexQuota.environments` | `[]` | Additional CLI configuration accounts on this host; multiple sources require selection |
| `codexQuota.language` | `auto` | `auto`, `zh-CN` or `en`; applies immediately |
| `codexQuota.showPublicIp` | `true` | Retrieve and display the extension host’s public IP |
| `codexQuota.statusBarPosition` | `right` | `left` or `right`; applies immediately |
| `codexQuota.cliPath` | `codex` | CLI on this host; missing default command is installed automatically; explicit paths are preserved |
| `codexQuota.autoInstallCli` | `true` | Automatically download the official CLI into this host’s extension storage when missing |
| `codexQuota.codexHome` | empty | Directory on the current host; inherits its `CODEX_HOME` or `~/.codex` |
| `codexQuota.refreshIntervalSeconds` | `300` | Automatic refresh interval, 60–3600 seconds |
| `codexQuota.requestTimeoutSeconds` | `60` | Quota query timeout, 5–120 seconds |

CLI paths and configuration directories have machine scope and are excluded from Settings Sync and workspace overrides. Configure `cliPath` / `codexHome` in local user settings for local windows and remote user settings for remote windows; remote hosts do not inherit local machine paths. Remote hosts still accept legacy `remoteCliPath` / `remoteCodexHome` only when the unified settings are unset. Local queries ignore those legacy keys. Language and position follow the effective user / workspace setting. Workspace trust is required to execute CLI. Browser VS Code and virtual workspaces are unsupported.

## Development

Use Node.js 20+:

```sh
npm ci
npm test
npm run test:bundle
npm run package
```

Native smoke tests use isolated unsigned-in homes. Real VS Code host tests target 1.95.3; Linux CI uses Xvfb. Public IP tests use injected HTTP responses, covering address validation, caching, timeouts and cancellation. See [TESTING.md](TESTING.md) for results and validation limits. Packaging creates one public VSIX under `artifacts/`, using one extension ID for installation on either host; it does not publish automatically.
