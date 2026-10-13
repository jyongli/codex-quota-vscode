import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { queryCodex } from '../src/cli';
import { discoverSources, mergeEquivalentSources } from '../src/sources';
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
    assert.equal(snapshot.cliPath, await realpath(executable));
    assert.equal(snapshot.codexHome, home);
  } finally { await cleanup(home); }
});

test('Windows 包装器直达原生程序，无控制台、不执行脚本内容，同目录同账号的 CLI／IDE 来源自动合并', { skip: process.platform !== 'win32' }, async () => {
  const home = await scenarioHome({});
  const previousPath = process.env.PATH;
  const previousHome = process.env.CODEX_HOME;
  try {
    const directory = path.join(home, 'Actual CLI 中文 with spaces');
    await mkdir(directory);
    const executable = path.join(directory, 'codex.exe');
    const compiler = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    await promisify(execFile)(compiler, ['/nologo', '/target:exe', `/out:${executable}`,
      path.resolve(__dirname, '../../test/fixtures/hidden-console.cs')], { windowsHide: true, timeout: 20_000 });
    const launcher = path.join(home, 'codex.cmd');
    const marker = path.join(home, 'shell-ran.txt');
    await writeFile(launcher, '@echo SCRIPT_MUST_NOT_RUN > "%~dp0shell-ran.txt"\r\n@"%~dp0Actual CLI 中文 with spaces\\codex.exe" %*\r\n');
    process.env.PATH = home;
    process.env.CODEX_HOME = home;
    const sources = await discoverSources('codex', home, [], { path: directory, cliPath: executable, sameHost: true, usesWsl: false });
    const merged = await mergeEquivalentSources(sources, source => queryCodex({ cliPath: source.cliPath, codexHome: source.codexHome, timeoutMs: 5000, accountOnly: true }));
    assert.equal(merged.length, 1);
    assert.equal(merged[0].includesIde, true);
    const snapshot = await queryCodex({ cliPath: launcher, codexHome: home, timeoutMs: 5000 });
    assert.equal(snapshot.account.type, 'signedOut');
    assert.equal(snapshot.cliPath, await realpath(executable));
    assert.equal(snapshot.codexHome, home);
    await assert.rejects(access(marker));
    await writeFile(launcher, 'echo SENSITIVE_MOCK_TOKEN\r\nexit 99');
    const resolvedLauncher = await realpath(launcher);
    await assert.rejects(queryCodex({ cliPath: launcher, codexHome: home, timeoutMs: 5000 }), reason => {
      assert.match(String(reason), /无法解析此 CLI 包装脚本/);
      assert.doesNotMatch(String(reason), /SENSITIVE_MOCK_TOKEN/);
      assert.equal((reason as import('../src/cli').CodexQueryError).diagnostic.cliPath, resolvedLauncher);
      return true;
    });
    await assert.rejects(access(marker));
  } finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    if (previousHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previousHome;
    await cleanup(home);
  }
});
