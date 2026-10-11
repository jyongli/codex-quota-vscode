const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { runTests } = require('@vscode/test-electron');
const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-quota-host-workspace-'));
const testProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-quota-host-profile-'));
const testExtensions = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-quota-host-extensions-'));
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-quota-host-login-'));
fs.mkdirSync(path.join(testProfile, 'User'));
// Seed the ordinary user setting before startup activation, keeping host tests offline.
fs.writeFileSync(path.join(testHome, 'scenario.json'), JSON.stringify({ account: null }));
fs.writeFileSync(path.join(testProfile, 'User/settings.json'), JSON.stringify({
  'codexQuota.showPublicIp': false,
  'codexQuota.cliPath': path.resolve(__dirname, '../test/fixtures/codex.cjs'),
  'codexQuota.codexHome': testHome
}));
runTests({
  version: '1.95.3',
  timeout: 15000,
  vscodeExecutablePath: process.env.CODEX_QUOTA_VSCODE_EXECUTABLE,
  extensionDevelopmentPath: [
    process.env.CODEX_QUOTA_EXTENSION_DEVELOPMENT_PATH ?? path.resolve(__dirname, '..')
  ],
  extensionTestsPath: path.resolve(__dirname, '../out/test/vscode/suite.js'),
  launchArgs: [testWorkspace, '--user-data-dir', testProfile, '--extensions-dir', testExtensions, '--no-sandbox', '--disable-gpu', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
  extensionTestsEnv: { ELECTRON_RUN_AS_NODE: undefined }
}).catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => {
    const cleanup = { recursive: true, force: true, maxRetries: 10, retryDelay: 100 };
    fs.rmSync(testWorkspace, cleanup);
    fs.rmSync(testProfile, cleanup);
    fs.rmSync(testExtensions, cleanup);
    fs.rmSync(testHome, cleanup);
  });
