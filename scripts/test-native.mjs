import { mkdir, mkdtemp, readFile, realpath, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import cli from '../out/src/cli.js';
import installer from '../out/src/cliInstall.js';
const testHome = await mkdtemp(path.join(tmpdir(), 'codex-quota-native-'));
// Fresh native binaries get the extension's default startup budget, including
// on slower Windows runners. A hung process still fails and is terminated.
const timeoutMs = 60_000;
try {
  const home = path.join(testHome, 'Codex home 中文 with spaces');
  const database = path.join(testHome, 'Configured database 中文');
  const logs = path.join(testHome, 'Configured logs with spaces');
  await mkdir(home);
  await mkdir(database);
  await mkdir(logs);
  await writeFile(path.join(home, 'config.toml'), `sqlite_home = ${JSON.stringify(database)}\nlog_dir = ${JSON.stringify(logs)}\n`);
  const npm = await installer.resolveNpm();
  const npmDirectory = path.join(testHome, 'npm only with spaces');
  const npmBin = path.join(npmDirectory, 'node_modules', 'npm', 'bin');
  await mkdir(npmBin, { recursive: true });
  await writeFile(path.join(npmDirectory, process.platform === 'win32' ? 'npm.cmd' : 'npm'), 'shell wrappers must not run');
  await writeFile(path.join(npmBin, 'npm-cli.js'), `require(${JSON.stringify(npm)});\n`);
  const options = { cliPath: 'codex', storagePath: path.join(testHome, 'managed CLI'), autoInstall: true,
    env: { ...process.env, PATH: npmDirectory } };
  const managed = await installer.ensureCli(options, new AbortController().signal);
  assert.equal(await installer.ensureCli(options, new AbortController().signal), managed);
  const installedVersion = JSON.parse(await readFile(path.join(path.dirname(managed), '..', 'package.json'), 'utf8')).version;
  console.log(`Checking newly installed @openai/codex@${installedVersion} with a ${timeoutMs / 1000}s startup budget`);
  assert.equal((await cli.queryCodex({ cliPath: managed, codexHome: home, timeoutMs })).account.type, 'signedOut');
  console.log(`PASS: missing CLI automatically installs official @openai/codex@${installedVersion} from the registry, reuses storage, and reads an isolated account`);
  const snapshot = await cli.queryCodex({
    cliPath: process.argv[2] ?? 'codex', codexHome: home,
    timeoutMs
  });
  assert.equal(snapshot.account.type, 'signedOut');
  assert.equal(snapshot.quota, undefined);
  assert.equal(await realpath(snapshot.codexHome), await realpath(home));
  assert.ok((await readdir(database)).some(name => name.endsWith('.sqlite')), 'CLI must honor the configured database directory');
  console.log('PASS: native Codex CLI initialize/account/read; unsigned-in state; spaces/Unicode; configured database directory (no credentials)');
  const blockedHome = path.join(testHome, 'home path is a file');
  await writeFile(blockedHome, 'not a directory');
  await assert.rejects(cli.queryCodex({ cliPath: process.argv[2] ?? 'codex', codexHome: blockedHome, timeoutMs }), error => {
    assert.ok(error instanceof cli.CodexQueryError);
    assert.equal(error.diagnostic.phase, '启动并初始化 CLI');
    assert.ok(typeof error.diagnostic.exitCode === 'number' && error.diagnostic.exitCode !== 0);
    assert.match(error.message, /配置目录无效/);
    return true;
  });
  console.log('PASS: native CLI startup failure reports its exit code, initialization phase and safe error classification');
} catch (error) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const message = `${error.message}${error.diagnostic ? ` ${JSON.stringify(error.diagnostic)}` : ''}`;
    console.log(`::error title=Native CLI smoke failure::${message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }
  throw error;
} finally {
  // Windows can briefly retain SQLite file handles after the CLI has exited.
  // Retry cleanup errors; functional assertions above still fail immediately.
  await rm(testHome, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
