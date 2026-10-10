# Codex Quota for VS Code

[中文](README.md) | English

Codex Quota is a **Visual Studio Code extension** that displays the remaining quota for the extension host’s currently signed-in **Codex CLI ChatGPT account**.

- Both quota windows available: `Codex [Local] 5h 75% · Week 60%`.
- Weekly window only: `Codex [Local] Week 60%`.
- Install the same VSIX locally or remotely; query that machine’s CLI and signed-in account.
- Configure status bar side and display language in VS Code Settings; changes apply immediately.
- The tooltip shows the extension host’s network interface IP, public outbound IP, account, quota resets, last check and refresh interval.

## Installation

Use desktop VS Code 1.95+ and the [official Codex CLI](https://github.com/openai/codex) on each machine you want to query. Sign in with `codex login` using ChatGPT. Codex CLI 0.116.0+ is recommended; Windows and Linux tests also use 0.162.1.

Download version 0.1.10 from [GitHub Releases](https://github.com/jyongli/codex-quota-vscode/releases):

- [Codex Quota VSIX](https://github.com/jyongli/codex-quota-vscode/releases/download/v0.1.10/codex-quota-vscode-0.1.10.vsix)

Install using **Extensions → … → Install from VSIX**. In a local window install under **Local**. In an SSH / WSL / Dev Container / desktop Codespaces window install the **same extension, same VSIX** on that remote host using the remote Extensions group or **Install from VSIX**. Install and sign in to Codex CLI on that machine too.

The extension uses `extensionKind: ["workspace"]`: local windows read the local CLI, account and IP; remote windows read the remote host’s CLI, account and IP. When installed on both sides, VS Code runs one instance in the active workspace host, with one quota status item. A remote window requires a remote installation; a local-only copy does not query locally from that remote window. Failed remote queries never fall back to a local account. The extension does not request window reloads or install companion extensions; VS Code controls whether initial installation / upgrades require activation or an extension reload.

The status bar shows `[Local]` / `[Remote]`, the tooltip shows the machine’s IP, and **View account and quota source** includes the actual host type and paths. **Developer: Show Running Extensions** can verify its location.

Upgrading: the manual environment selector and `codexQuota.executionEnvironment` are removed. The old **Codex Quota Remote** companion can be uninstalled. Remove any custom `remote.extensionKind` override for this extension to apply the new workspace-host model; the extension does not rewrite host overrides. Legacy remote path settings remain a fallback until the new unified settings are configured.

## Language and status bar settings

Click the status bar → **Open settings** to open Codex Quota’s settings. The menu contains only **Refresh quota**, **View account and quota source**, **View diagnostic log**, and **Open settings**.

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
| `codexQuota.language` | `auto` | `auto`, `zh-CN` or `en`; applies immediately |
| `codexQuota.showPublicIp` | `true` | Retrieve and display the extension host’s public IP |
| `codexQuota.statusBarPosition` | `right` | `left` or `right`; applies immediately |
| `codexQuota.cliPath` | `codex` | Executable or official npm JS entry on the current host |
| `codexQuota.codexHome` | empty | Directory on the current host; inherits its `CODEX_HOME` or `~/.codex` |
| `codexQuota.refreshIntervalSeconds` | `300` | Automatic refresh interval, 60–3600 seconds |
| `codexQuota.requestTimeoutSeconds` | `60` | Quota query timeout, 5–120 seconds |

CLI paths and configuration directories have machine scope and are excluded from Settings Sync and workspace overrides. Configure `cliPath` / `codexHome` in local user settings for local windows and remote user settings for remote windows; remote hosts do not inherit local machine paths. Remote hosts still accept legacy `remoteCliPath` / `remoteCodexHome` only when the unified settings are unset. Local queries ignore those legacy keys. Language and position follow the effective user / workspace setting. Workspace trust is required to execute CLI. Browser VS Code and virtual workspaces are unsupported.

## Development

For VS Code Marketplace credentials and submission, see [the publishing guide](MARKETPLACE.md). The workflow uploads an existing GitHub release VSIX after verifying its checksum and successful Windows / Linux checks.

Use Node.js 20+:

```sh
npm ci
npm test
npm run test:bundle
npm run package
```

Native smoke tests use isolated unsigned-in homes. Real VS Code host tests target 1.95.3; Linux CI uses Xvfb. Public IP tests use injected HTTP responses, covering address validation, caching, timeouts and cancellation. See [TESTING.md](TESTING.md) for results and validation limits. Packaging creates one public VSIX under `artifacts/`, using one extension ID for installation on either host; it does not publish automatically.
