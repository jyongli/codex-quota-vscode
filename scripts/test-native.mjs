import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import cli from '../out/src/cli.js';
const testHome = await mkdtemp(path.join(tmpdir(), 'codex-quota-native-'));
try {
  const snapshot = await cli.queryCodex({
    cliPath: process.argv[2] ?? 'codex', codexHome: testHome,
    runtimeDirectory: path.join(testHome, 'helper'), timeoutMs: 20_000
  });
  assert.equal(snapshot.account.type, 'signedOut');
  assert.equal(snapshot.quota, undefined);
  assert.equal(await realpath(snapshot.codexHome), await realpath(testHome));
  console.log('PASS: native Codex CLI initialize/account/read and unsigned-in state (isolated configuration, no credentials)');
} finally {
  await rm(testHome, { recursive: true, force: true });
}
