import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureCli, resolveNpm } from '../src/cliInstall';
import { queryCodex } from '../src/cli';
import { cleanup, fixtureCli, scenarioHome } from './helpers';
import { npmFixture } from './install-helpers';

const signal = () => new AbortController().signal;

test('已有 CLI 不安装；明确路径错误、禁用自动安装和相对路径不改用其他 CLI', async () => {
  const home = await scenarioHome({});
  const options = { storagePath: path.join(home, 'storage'), autoInstall: true, env: { PATH: '' } };
  try {
    assert.equal(await ensureCli({ ...options, cliPath: fixtureCli }, signal()), fixtureCli);
    await assert.rejects(access(options.storagePath));
    for (const cliPath of [path.join(home, 'missing.js'), './codex']) await assert.rejects(ensureCli({ ...options, cliPath }, signal()), /CLI/);
    await assert.rejects(ensureCli({ ...options, cliPath: 'codex', autoInstall: false }, signal()), /找不到 Codex/);
    await assert.rejects(ensureCli({ ...options, cliPath: 'codex' }, signal()), /找不到 npm/);
    await assert.rejects(ensureCli({ ...options, cliPath: 'codex', env: { PATH: '.' } }, signal()), /找不到 npm/);
  } finally { await cleanup(home); }
});

test('npm Windows 包装入口直接解析 JS，不执行 shell；不支持的包装脚本给出提示', async () => {
  const home = await scenarioHome({});
  try {
    const bin = path.join(home, 'node_modules', 'npm', 'bin');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(home, 'npm.cmd'), 'exit 99');
    await writeFile(path.join(bin, 'npm-cli.js'), '');
    assert.equal(await resolveNpm({ PATH: home }, 'win32'), await realpath(path.join(bin, 'npm-cli.js')));
    await assert.rejects(resolveNpm({ PATH: '' }), /找不到 npm/);
  } finally { await cleanup(home); }
});

test('首次后台安装官方包，两个调用合并；复用缓存并可读取同一配置的账号', async () => {
  const home = await scenarioHome({ account: null });
  try {
    const env = await npmFixture(home, { delay: 300 });
    const options = { cliPath: 'codex', storagePath: path.join(home, 'storage'), autoInstall: true, env };
    let installing = 0;
    const [entry, second] = await Promise.all([ensureCli({ ...options, onInstalling: () => installing++ }, signal()), ensureCli(options, signal())]);
    assert.equal(entry, second);
    assert.equal(installing, 1);
    assert.equal(await ensureCli(options, signal()), entry);
    assert.equal(await ensureCli({ ...options, autoInstall: false }, signal()), entry);
    const trace = (await readFile(path.join(home, 'npm-trace.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { args: string[]; cwd: string; electron: string });
    assert.equal(trace.length, 1);
    assert.ok(trace[0].args.includes('@openai/codex@latest'));
    for (const arg of ['--ignore-scripts', '--include=optional', '--registry=https://registry.npmjs.org']) assert.ok(trace[0].args.includes(arg));
    assert.equal(trace[0].electron, '1');
    assert.equal(await realpath(path.dirname(trace[0].cwd)), await realpath(options.storagePath));
    assert.ok(path.basename(trace[0].cwd).startsWith('codex-cli-install-'));
    assert.equal((await queryCodex({ cliPath: entry, codexHome: home, timeoutMs: 5000 })).account.type, 'signedOut');
    await assert.rejects(access(path.join(options.storagePath, 'codex-cli-install.lock')));
  } finally { await cleanup(home); }
});

test('Windows 默认未知包装器使用隔离官方 CLI，禁用自动安装保留原错误，自定义路径不替换', { skip: process.platform !== 'win32' }, async () => {
  const home = await scenarioHome({ account: null });
  try {
    const env = await npmFixture(home);
    const launcher = path.join(env.PATH!, 'codex.cmd');
    await writeFile(launcher, 'exit 99');
    const options = { cliPath: 'codex', storagePath: path.join(home, 'storage'), env, autoInstall: true };
    await assert.rejects(ensureCli({ ...options, autoInstall: false }, signal()), /无法解析此 CLI 包装脚本/);
    await assert.rejects(ensureCli({ ...options, cliPath: launcher }, signal()), /无法解析此 CLI 包装脚本/);
    await assert.rejects(access(path.join(home, 'npm-trace.jsonl')));
    const entry = await ensureCli(options, signal());
    assert.equal(await ensureCli({ ...options, autoInstall: false }, signal()), entry);
    assert.equal((await queryCodex({ cliPath: entry, codexHome: home, timeoutMs: 5000 })).account.type, 'signedOut');
    assert.equal(await readFile(launcher, 'utf8'), 'exit 99');
    const trace = (await readFile(path.join(home, 'npm-trace.jsonl'), 'utf8')).trim().split('\n');
    assert.equal(trace.length, 1);
  } finally { await cleanup(home); }
});

test('npm 失败分类且隐藏原始内容；残缺安装不进入缓存，修复后可重试', async () => {
  const home = await scenarioHome({});
  try {
    const env = await npmFixture(home, { fail: 1, stderr: 'ENOTFOUND SENSITIVE_NPM_TOKEN' });
    const options = { cliPath: 'codex', storagePath: path.join(home, 'storage'), autoInstall: true, env };
    await assert.rejects(ensureCli(options, signal()), error => {
      assert.match(String(error), /自动安装失败.*网络/); assert.doesNotMatch(String(error), /SENSITIVE_NPM_TOKEN/); return true;
    });
    await writeFile(path.join(home, 'npm-scenario.json'), JSON.stringify({ incomplete: true }));
    await assert.rejects(ensureCli(options, signal()), /未安装完整/);
    await assert.rejects(access(path.join(options.storagePath, 'codex-cli')));
    await writeFile(path.join(home, 'npm-scenario.json'), '{}');
    await ensureCli(options, signal());
  } finally { await cleanup(home); }
});

test('安装超时及取消终止后台进程并清理锁和半成品', async () => {
  const home = await scenarioHome({});
  try {
    const env = await npmFixture(home, { hang: true });
    const options = { cliPath: 'codex', storagePath: path.join(home, 'storage'), autoInstall: true, env };
    await assert.rejects(ensureCli({ ...options, timeoutMs: 1000 }, signal()), /安装超时/);
    const abort = new AbortController();
    const pending = ensureCli(options, abort.signal);
    const timer = setTimeout(() => abort.abort(), 500);
    try { await assert.rejects(pending, /取消/); } finally { clearTimeout(timer); }
    const trace = (await readFile(path.join(home, 'npm-trace.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { pid: number });
    assert.equal(trace.length, 2);
    for (const { pid } of trace) assert.throws(() => process.kill(pid, 0));
    await assert.rejects(access(path.join(options.storagePath, 'codex-cli-install.lock')));
    await assert.rejects(access(path.join(options.storagePath, 'codex-cli')));
  } finally { await cleanup(home); }
});
