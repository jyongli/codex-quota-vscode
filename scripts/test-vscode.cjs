const path = require('node:path');
const { runTests } = require('@vscode/test-electron');
runTests({
  version: '1.95.3',
  timeout: 15000,
  vscodeExecutablePath: process.env.CODEX_QUOTA_VSCODE_EXECUTABLE,
  extensionDevelopmentPath: process.env.CODEX_QUOTA_EXTENSION_DEVELOPMENT_PATH ?? path.resolve(__dirname, '..'),
  extensionTestsPath: path.resolve(__dirname, '../out/test/vscode/suite.js'),
  launchArgs: ['--no-sandbox', '--disable-gpu', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
  extensionTestsEnv: { ELECTRON_RUN_AS_NODE: undefined }
}).catch(error => { console.error(error.message); process.exitCode = 1; });
