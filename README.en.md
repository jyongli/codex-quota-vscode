# Codex Quota for VS Code

[中文](README.md) | English

Codex Quota is a **Visual Studio Code extension** that displays the remaining quota for the selected machine’s currently signed-in **Codex CLI ChatGPT account**.

- Both quota windows available: `Codex [Local] 5h 75% · Week 60%`.
- Weekly window only: `Codex [Local] Week 60%`.
- Switch local / remote queries, status bar side and display language immediately.
- The tooltip shows the selected host’s network interface IP, public outbound IP, account, quota resets, last check and refresh interval.

## Installation

Use desktop VS Code 1.95+ and the [official Codex CLI](https://github.com/openai/codex) on each machine you want to query. Sign in with `codex login` using ChatGPT. Codex CLI 0.116.0+ is recommended; Windows and Linux tests also use 0.162.1.

Download version 0.1.6 from [GitHub Releases](https://github.com/jyongli/codex-quota-vscode/releases):

- [Local main extension](https://github.com/jyongli/codex-quota-vscode/releases/download/v0.1.6/codex-quota-vscode-0.1.6.vsix)
- [Remote query component](https://github.com/jyongli/codex-quota-vscode/releases/download/v0.1.6/codex-quota-remote-0.1.6.vsix)

Install using **Extensions → … → Install from VSIX**. Install the main extension locally. To query SSH / WSL / Dev Container / desktop Codespaces hosts, install the matching Codex Quota Remote VSIX on the remote host, then choose the environment from the status bar menu. Both components must have the same version. Switching queries cancels the previous request and clears its quota without reloading the window. Missing remote components produce an error; the extension does not substitute a local account.

## Display language

Click the status bar → **Choose display language** → **Follow VS Code**, **中文**, or **English**. The extension menus, status bar, tooltip, account descriptions and errors update immediately, preserving the quota snapshot without restarting the query or window. Automatic mode uses Chinese for Chinese VS Code locales and English otherwise.

Command palette titles, extension descriptions and VS Code settings labels follow VS Code’s own display language through manifest localization. The extension’s independent language option controls runtime UI. Actual account emails, IP addresses, paths and plan names remain unchanged.

## Host addresses

**IP address** lists non-loopback addresses from the machine performing the query, preferring IPv4. **Public IP** is retrieved by that same machine from `https://api64.ipify.org` over HTTPS and may be IPv4 or IPv6. Local mode uses the local machine; remote mode uses the remote host. The request contains no account information or credentials. The result reflects the outbound route used by the HTTPS request, including any relevant VPN or proxy configuration.

Public IP results are cached in memory for five minutes per host. Requests time out independently after three seconds; unavailable addresses show `Unavailable` while quota querying continues. Failures are cached for 30 seconds. Set `codexQuota.showPublicIp` to `false` to hide the line and stop public IP requests.

## Account source and queries

Queries use the official `codex app-server --listen stdio://` protocol: initialize, `account/read`, `account/rateLimits/read` for ChatGPT accounts, then a second account read to avoid mixing accounts if login changes. The account comes from Codex CLI on the selected host, independently of VS Code’s GitHub login. The extension does not read `auth.json`, decode JWTs or handle login credentials itself.

API Key, Bedrock and signed-out states are identified explicitly. Remaining percentages are `max(0, 100 - usedPercent)`; windows are identified by their 300 / 10080 minute durations. `—` indicates an unknown window. Failures clear previous quota and provide a diagnostic action. Raw upstream errors and stderr are excluded from extension UI and logs. CLI processes run in the background using pipes, `shell: false` and `windowsHide: true`; official Windows npm entries resolve directly to their installed native executable.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `codexQuota.language` | `auto` | `auto`, `zh-CN` or `en`; applies immediately |
| `codexQuota.showPublicIp` | `true` | Retrieve and display the selected host’s public IP |
| `codexQuota.executionEnvironment` | `local` | `local` or `remote`; applies immediately |
| `codexQuota.statusBarPosition` | `right` | `left` or `right`; applies immediately |
| `codexQuota.cliPath` | `codex` | Local executable or official npm JS entry; local user setting |
| `codexQuota.codexHome` | empty | Local directory; inherits local `CODEX_HOME` or `~/.codex` |
| `codexQuota.remoteCliPath` | `codex` | Remote executable path; remote user setting |
| `codexQuota.remoteCodexHome` | empty | Remote directory; inherits remote `CODEX_HOME` or `~/.codex` |
| `codexQuota.refreshIntervalSeconds` | `300` | Automatic refresh interval, 60–3600 seconds |
| `codexQuota.requestTimeoutSeconds` | `60` | Quota query timeout, 5–120 seconds |

Local CLI settings have application scope; remote settings use separate machine-scoped keys because VS Code supplies merged configuration to both hosts. For versions before 0.1.5, move custom remote paths to the `remoteCliPath` / `remoteCodexHome` settings. Menu actions update the effective user or workspace setting. Workspace trust is required to execute CLI. Browser VS Code and virtual workspaces are unsupported.

## Development

Use Node.js 20+:

```sh
npm ci
npm test
npm run test:bundle
npm run package
```

Native smoke tests use isolated unsigned-in homes. Real VS Code host tests target 1.95.3; Linux CI uses Xvfb. Public IP tests use injected HTTP responses, covering address validation, caching, timeouts and cancellation. See [TESTING.md](TESTING.md) for results and validation limits. Packaging creates both VSIX files under `artifacts/`; it does not publish automatically.
