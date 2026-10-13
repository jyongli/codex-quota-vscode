import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { CodexQueryError, queryCodex, resolveCli } from '../src/cli';
import { cleanup, fixtureCli, readTrace, scenarioHome } from './helpers';
import { quotaText } from '../src/quota';

async function withScenario(value: unknown, run: (home: string) => Promise<void>): Promise<void> {
  const home = await scenarioHome(value);
  try { await run(home); } finally { await cleanup(home); }
}

test('真实子进程 JSONL 握手、分片、通知、账号来源及额度读取', async () => {
  await withScenario({ fragmented: true }, async home => {
    const snapshot = await queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 });
    assert.equal(snapshot.account.type, 'chatgpt');
    assert.equal(quotaText(snapshot.quota!), '5 小时 75% · 周 60%');
    assert.equal(snapshot.codexHome, home);
    assert.equal(snapshot.cliPath, fixtureCli);
    const trace = await readTrace(home);
    assert.deepEqual(trace[0].args, ['app-server', '--listen', 'stdio://']);
    assert.deepEqual(trace.slice(1).map(row => row.method), ['initialize', 'initialized', 'account/read', 'account/rateLimits/read', 'account/read']);
    assert.deepEqual(trace[3].params, { refreshToken: false });
    assert.throws(() => process.kill(trace[0].pid as number, 0), { code: 'ESRCH' });
  });
});

test('未登录、API Key 与 Bedrock 不调用订阅额度接口', async () => {
  for (const account of [null, { type: 'apiKey' }, { type: 'amazonBedrock' }]) {
    await withScenario({ account }, async home => {
      const snapshot = await queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 });
      assert.equal(snapshot.quota, undefined);
      assert.ok(!(await readTrace(home)).some(row => row.method === 'account/rateLimits/read'));
    });
  }
});

test('来源检测仅查询实际目录和账号，不调用额度接口，结束后台进程', async () => {
  await withScenario({ error: -32000 }, async home => {
    const snapshot = await queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000, accountOnly: true });
    assert.equal(snapshot.codexHome, home);
    assert.deepEqual(snapshot.account, { type: 'chatgpt', email: 'fixture@example.test', planType: 'plus' });
    assert.equal(snapshot.quota, undefined);
    const trace = await readTrace(home);
    assert.deepEqual(trace.slice(1).map(row => row.method), ['initialize', 'initialized', 'account/read']);
    assert.throws(() => process.kill(trace[0].pid as number, 0), { code: 'ESRCH' });
  });
});

test('额度读取期间账号变化会拒绝混合快照', async () => {
  await withScenario({ changeAccount: true }, async home => {
    await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 }), /账号发生变化/);
  });
});

test('RPC 错误明确处理且不泄漏原始错误或 stderr 中的敏感内容', async () => {
  for (const error of [-32601, -32000]) {
    await withScenario({ error }, async home => {
      await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 }), (reason: Error) => {
        assert.ok(!reason.message.includes('SENSITIVE_MOCK_TOKEN'));
        assert.match(reason.message, error === -32601 ? /升级/ : /错误码 -32000/);
        return true;
      });
    });
  }
});

test('挂起请求超时并结束子进程', async () => {
  await withScenario({ hang: true }, async home => {
    await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 350 }), /启动并初始化 CLI超时/);
    const trace = await readTrace(home);
    assert.throws(() => process.kill(trace[0].pid as number, 0), { code: 'ESRCH' });
  });
});

test('外部取消会结束查询，已取消请求不会启动 CLI', async () => {
  await withScenario({ hang: true }, async home => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 250);
    try {
      await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 }, controller.signal), /已取消/);
    } finally { clearTimeout(timer); }
    const trace = await readTrace(home);
    assert.throws(() => process.kill(trace[0].pid as number, 0), { code: 'ESRCH' });
    await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 }, controller.signal), /已取消/);
    assert.equal((await readTrace(home)).filter(row => 'pid' in row).length, 1);
  });
});

test('提前退出、非 JSON 和过大输出都会失败而不是显示假额度', async () => {
  for (const scenario of [{ exit: true }, { malformed: true }, { huge: true }]) {
    await withScenario(scenario, async home => {
      await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 }));
    });
  }
});

test('不把 cliPath 作为 shell 命令执行，不执行工作区相对路径', async () => {
  await assert.rejects(resolveCli('codex; echo secret', { PATH: '/nonexistent' }), /找不到/);
  await assert.rejects(resolveCli('./codex'), /绝对路径/);
  await assert.rejects(resolveCli(''), /设置/);
  await assert.rejects(resolveCli('/nonexistent/codex'), /找不到/);
});

test('Windows 官方 npm shim 和 JS 入口直接解析到原生程序：x64／ARM64、平台依赖／旧 vendor、bin／codex 布局', async () => {
  for (const arch of ['x64', 'arm64'] as const) {
    for (const platformDependency of [true, false]) {
      for (const directory of ['bin', 'codex']) {
        await withScenario({}, async home => {
          await writeFile(path.join(home, 'codex.cmd'), 'wrapper must not run');
          const packageRoot = path.join(home, 'node_modules', '@openai', 'codex');
          const entry = path.join(packageRoot, 'bin', 'codex.js');
          await mkdir(path.dirname(entry), { recursive: true });
          await writeFile(entry, 'throw new Error("wrapper must not run")');
          await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@openai/codex' }));
          const vendorPackage = platformDependency ? path.join(home, 'node_modules', '@openai', `codex-win32-${arch}`) : packageRoot;
          await mkdir(vendorPackage, { recursive: true });
          if (platformDependency) await writeFile(path.join(vendorPackage, 'package.json'), '{}');
          const target = arch === 'x64' ? 'x86_64-pc-windows-msvc' : 'aarch64-pc-windows-msvc';
          const native = path.join(vendorPackage, 'vendor', target, directory, 'codex.exe');
          await mkdir(path.dirname(native), { recursive: true });
          await writeFile(native, '');
          for (const command of ['codex', entry]) {
            assert.deepEqual(await resolveCli(command, { PATH: home }, 'win32', arch), {
              executable: await realpath(native), args: [], packageRoot: await realpath(packageRoot)
            });
          }
        });
      }
    }
  }
});

test('Windows 官方 npm 原生依赖缺失时不退回会弹窗的 JS 包装器', async () => {
  await withScenario({}, async home => {
    const packageRoot = path.join(home, 'node_modules', '@openai', 'codex');
    const entry = path.join(packageRoot, 'bin', 'codex.js');
    await mkdir(path.dirname(entry), { recursive: true });
    await writeFile(entry, 'throw new Error("wrapper must not run")');
    await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@openai/codex' }));
    await assert.rejects(resolveCli(entry, {}, 'win32', 'x64'), /缺少 Windows 原生程序/);
    await assert.rejects(resolveCli(entry, {}, 'win32', 'ia32'), /架构不受/);
  });
});

test('Windows 直接配置 codex.exe 和非官方 JS 入口仍可使用', async () => {
  await withScenario({}, async home => {
    const native = path.join(home, 'codex.exe');
    await writeFile(native, '');
    assert.deepEqual(await resolveCli(native, {}, 'win32'), { executable: await realpath(native), args: [] });
    assert.deepEqual(await resolveCli(fixtureCli, {}, 'win32'), { executable: process.execPath, args: [fixtureCli] });
  });
});

async function officialWindowsPackage(root: string): Promise<{ entry: string; native: string; packageRoot: string }> {
  const packageRoot = path.join(root, 'node_modules', '@openai', 'codex');
  const entry = path.join(packageRoot, 'bin', 'codex.js');
  const native = path.join(packageRoot, 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
  await mkdir(path.dirname(entry), { recursive: true });
  await mkdir(path.dirname(native), { recursive: true });
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@openai/codex' }));
  await writeFile(entry, 'throw new Error("JS wrapper must not run")');
  await writeFile(native, '');
  return { entry, native, packageRoot };
}

test('Windows pnpm／Yarn／独立前缀与 PowerShell 包装器解析实际官方入口，不依赖相邻 npm 目录', async () => {
  await withScenario({}, async home => {
    const install = await officialWindowsPackage(path.join(home, 'Global install 中文 with spaces'));
    for (const [filename, invocation] of [
      ['codex.cmd', '"%dp0%\\..\\Global install 中文 with spaces\\node_modules\\@openai\\codex\\bin\\codex.js" %*'],
      ['codex.bat', '"%~dp0..\\Global install 中文 with spaces\\node_modules\\@openai\\codex\\bin\\codex.js" %*'],
      ['codex.ps1', '& "$basedir/../Global install 中文 with spaces/node_modules/@openai/codex/bin/codex.js" $args']
    ]) {
      const directory = path.join(home, filename + ' shims');
      await mkdir(directory);
      const launcher = path.join(directory, filename);
      await writeFile(launcher, invocation + '\r\n');
      const expected = { executable: await realpath(install.native), args: [], packageRoot: await realpath(install.packageRoot) };
      assert.deepEqual(await resolveCli(launcher, {}, 'win32', 'x64'), expected);
      assert.deepEqual(await resolveCli('codex', { PATH: directory }, 'win32', 'x64'), expected);
    }
  });
});

test('Windows 原生包装器支持绝对路径、常用安装目录变量及 UTF-16 PowerShell，保持参数数组启动', async () => {
  await withScenario({}, async home => {
    const directory = path.join(home, 'Native CLI 中文 with spaces');
    await mkdir(directory);
    const native = path.join(directory, 'codex.exe');
    await writeFile(native, '');
    const launcher = path.join(home, 'codex.cmd');
    for (const invocation of [`@"${native}" %*`, '@"%LOCALAPPDATA%\\Native CLI 中文 with spaces\\codex.exe" %*',
      '@"%~dp0Native CLI 中文 with spaces\\codex.exe" %*']) {
      await writeFile(launcher, invocation + '\r\n');
      assert.deepEqual(await resolveCli(launcher, { LocalAppData: home }, 'win32'), { executable: await realpath(native), args: [] });
    }
    const powershell = path.join(home, 'codex.ps1');
    await writeFile(powershell, Buffer.concat([Buffer.from([255, 254]), Buffer.from('& "$PSScriptRoot/Native CLI 中文 with spaces/codex.exe" @args\r\n', 'utf16le')]));
    assert.deepEqual(await resolveCli(powershell, {}, 'win32'), { executable: await realpath(native), args: [] });
  });
});

test('Windows 不受支持或残缺的 PATH 包装器不会遮住后续可用 CLI；显式路径保留错误', async () => {
  await withScenario({}, async home => {
    const invalid = path.join(home, 'Invalid shim');
    const valid = path.join(home, 'Valid shim');
    await mkdir(invalid); await mkdir(valid);
    const launcher = path.join(invalid, 'codex.cmd');
    await writeFile(launcher, 'exit 99');
    const native = path.join(valid, 'codex.exe');
    await writeFile(native, '');
    const env = { PATH: invalid + ';' + valid };
    assert.deepEqual(await resolveCli('codex', env, 'win32'), { executable: await realpath(native), args: [] });
    await assert.rejects(resolveCli(launcher, env, 'win32'), /无法解析此 CLI 包装脚本/);
    const incomplete = await officialWindowsPackage(invalid);
    await writeFile(launcher, `"${incomplete.entry}" %*`);
    await rm(incomplete.native);
    assert.deepEqual(await resolveCli('codex', env, 'win32'), { executable: await realpath(native), args: [] });
    await assert.rejects(resolveCli(launcher, env, 'win32'), /缺少 Windows 原生程序/);
  });
});

test('未知包装器、注入额外参数、未展开变量和相对项目目标不执行', async () => {
  await withScenario({}, async home => {
    const native = path.join(home, 'codex.exe');
    await writeFile(native, '');
    const launcher = path.join(home, 'codex.cmd');
    for (const content of ['codex %*', `"${native}" --different-account %*`, `"${native}" %* & echo SENSITIVE_MOCK_TOKEN`,
      '".\\codex.exe" %*', '"%UNKNOWN_TOKEN%\\codex.exe" %*',
      '"$(Get-Content auth.json)\\@openai\\codex\\bin\\codex.js" %*']) {
      await writeFile(launcher, content);
      await assert.rejects(resolveCli(launcher, {}, 'win32'), reason => {
        assert.match(String(reason), /无法解析此 CLI 包装脚本/);
        assert.doesNotMatch(String(reason), /SENSITIVE_MOCK_TOKEN|UNKNOWN_TOKEN/);
        return true;
      });
    }
  });
});

test('账号与额度接口挂起时显示对应超时阶段，并回收进程', async () => {
  for (const [hangMethod, expected] of [['account/read', /读取账号超时/], ['account/rateLimits/read', /读取额度超时/]] as const) {
    await withScenario({ hangMethod }, async home => {
      await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 500 }), expected);
      const trace = await readTrace(home);
      assert.throws(() => process.kill(trace[0].pid as number, 0), { code: 'ESRCH' });
    });
  }
});

test('相对 CODEX_HOME 被拒绝', async () => {
  await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: './credentials', timeoutMs: 3000 }), /绝对路径/);
});

test('显式使用 stdio，沿用 CLI 配置，不注入数据库与日志覆盖参数', async () => {
  await withScenario({}, async home => {
    const snapshot = await queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 });
    assert.equal(snapshot.codexHome, home);
    assert.deepEqual((await readTrace(home))[0].args, ['app-server', '--listen', 'stdio://']);
    assert.equal((await readTrace(home))[0].electronRunAsNode, '1');
  });
});

test('提前退出报告阶段、退出码与安全分类，不暴露原始 stderr', async () => {
  for (const [exitMethod, phase, phaseKey, stderr, hint] of [
    ['initialize', '启动并初始化 CLI', 'phaseInitialize', 'failed to initialize sqlite state runtime SENSITIVE_MOCK_TOKEN', /数据库/],
    ['account/rateLimits/read', '读取额度', 'phaseQuota', 'TOML parse error SENSITIVE_MOCK_TOKEN', /配置解析/],
    ['account/read', '读取账号', 'phaseAccount', 'unknown error SENSITIVE_MOCK_TOKEN', /诊断日志/]
  ] as const) {
    await withScenario({ exitMethod, stderr }, async home => {
      await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 }), reason => {
        assert.ok(reason instanceof CodexQueryError);
        assert.match(reason.message, /退出码 4/);
        assert.match(reason.message, hint);
        assert.ok(!reason.message.includes('SENSITIVE_MOCK_TOKEN'));
        assert.deepEqual(reason.diagnostic, { phase, phaseKey, cliPath: fixtureCli, codexHome: home, exitCode: 4, signal: null });
        return true;
      });
    });
  }
});
