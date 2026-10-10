const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { runTests } = require('@vscode/test-electron');
const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-quota-host-workspace-'));
const testProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-quota-host-profile-'));
fs.mkdirSync(path.join(testProfile, 'User'));
// Seed the ordinary user setting before startup activation, keeping host tests offline.
fs.writeFileSync(path.join(testProfile, 'User/settings.json'), JSON.stringify({ 'codexQuota.showPublicIp': false }));
runTests({
  version: '1.95.3',
  timeout: 15000,
  vscodeExecutablePath: process.env.CODEX_QUOTA_VSCODE_EXECUTABLE,
  extensionDevelopmentPath: [
    process.env.CODEX_QUOTA_EXTENSION_DEVELOPMENT_PATH ?? path.resolve(__dirname, '..'),
    process.env.CODEX_QUOTA_REMOTE_DEVELOPMENT_PATH ?? path.resolve(__dirname, '../remote-provider')
  ],
  extensionTestsPath: path.resolve(__dirname, '../out/test/vscode/suite.js'),
  launchArgs: [testWorkspace, '--user-data-dir', testProfile, '--no-sandbox', '--disable-gpu', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
  extensionTestsEnv: { ELECTRON_RUN_AS_NODE: undefined }
}).catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => {
    fs.rmSync(testWorkspace, { recursive: true, force: true });
    fs.rmSync(testProfile, { recursive: true, force: true });
  });
