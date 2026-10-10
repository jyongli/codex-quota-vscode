import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { queryCodex, resolveCli } from '../src/cli';
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
    assert.deepEqual(trace[0].args, ['app-server']);
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
    await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 350 }), /取消或超时/);
    const trace = await readTrace(home);
    assert.throws(() => process.kill(trace[0].pid as number, 0), { code: 'ESRCH' });
  });
});

test('外部取消会结束查询，已取消请求不会启动 CLI', async () => {
  await withScenario({ hang: true }, async home => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 250);
    try {
      await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 }, controller.signal), /取消或超时/);
    } finally { clearTimeout(timer); }
    const trace = await readTrace(home);
    assert.throws(() => process.kill(trace[0].pid as number, 0), { code: 'ESRCH' });
    await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: home, timeoutMs: 3000 }, controller.signal), /取消或超时/);
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

test('Windows 官方 npm shim 解析为 JavaScript，不启用 shell', async () => {
  await withScenario({}, async home => {
    await writeFile(path.join(home, 'codex.cmd'), 'unused wrapper');
    const entry = path.join(home, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    await mkdir(path.dirname(entry), { recursive: true });
    await writeFile(entry, '');
    const resolved = await resolveCli('codex', { PATH: home }, 'win32');
    assert.equal(resolved.executable, process.execPath);
    assert.deepEqual(resolved.args, [entry]);
  });
});

test('相对 CODEX_HOME 被拒绝', async () => {
  await assert.rejects(queryCodex({ cliPath: fixtureCli, codexHome: './credentials', timeoutMs: 3000 }), /绝对路径/);
});

test('辅助数据库和日志单独存储，不改变账号配置目录', async () => {
  await withScenario({}, async home => {
    const runtimeDirectory = path.join(home, 'helper-data');
    const snapshot = await queryCodex({ cliPath: fixtureCli, codexHome: home, runtimeDirectory, timeoutMs: 3000 });
    assert.equal(snapshot.codexHome, home);
    assert.deepEqual((await readTrace(home))[0].args, ['app-server', '-c', `sqlite_home=${JSON.stringify(runtimeDirectory)}`, '-c', `log_dir=${JSON.stringify(runtimeDirectory)}`]);
  });
});
