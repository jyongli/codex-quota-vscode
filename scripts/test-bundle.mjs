import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'out/test/extension.test.js'], {
  stdio: 'inherit', env: { ...process.env, CODEX_QUOTA_TEST_BUNDLE: '1' }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
