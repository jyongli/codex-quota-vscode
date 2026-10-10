import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { queryCodex } from '../src/cli';
import { cleanup, scenarioHome } from './helpers';

test('Windows 原生查询进程不分配命令行窗口，仍可进行真实管道握手和账号读取', { skip: process.platform !== 'win32' }, async () => {
  const home = await scenarioHome({});
  try {
    const directory = path.join(home, 'CLI with spaces');
    await mkdir(directory);
    const executable = path.join(directory, 'console-probe.exe');
    const compiler = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    await promisify(execFile)(compiler, [
      '/nologo', '/target:exe', `/out:${executable}`, path.resolve(__dirname, '../../test/fixtures/hidden-console.cs')
    ], { windowsHide: true, timeout: 20_000 });
    const snapshot = await queryCodex({ cliPath: executable, codexHome: home, timeoutMs: 5000 });
    assert.equal(snapshot.account.type, 'signedOut');
    assert.equal(snapshot.cliPath, executable);
    assert.equal(snapshot.codexHome, home);
  } finally { await cleanup(home); }
});
