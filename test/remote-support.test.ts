import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTALL_EXTENSION, RemoteSupport } from '../src/remoteSupport';
import { fail, message } from '../src/i18n';
import { REMOTE_PROTOCOL, REMOTE_QUERY, REMOTE_READY, RemoteReply } from '../src/remoteProtocol';

const ready = { protocol: REMOTE_PROTOCOL, ready: true };
const reply = (): RemoteReply => ({ protocol: REMOTE_PROTOCOL, remoteName: 'ssh-remote', hostIp: '10.0.0.20', ok: true,
  snapshot: { account: { type: 'signedOut' }, cliPath: '/remote/codex', codexHome: '/remote/.codex', checkedAt: '2026-10-10T00:00:00Z' } });

test('首次远程查询缺少组件时仅安装内置 VSIX，等待注册后读取远程账号', async () => {
  const archive = { uri: 'file:///local/extension/bundled/remote.vsix' };
  const calls: { command: string; argument: unknown }[] = [];
  const phases: boolean[] = [];
  let installed = false;
  const support = new RemoteSupport(async (command, argument) => {
    calls.push({ command, argument });
    if (command === INSTALL_EXTENSION) { assert.equal(argument, archive); installed = true; return; }
    return installed ? command === REMOTE_READY ? ready : reply() : undefined;
  }, archive);
  const result = await support.query('ssh-remote', 5000, new AbortController().signal, true, value => phases.push(value));
  assert.equal(result.codexHome, '/remote/.codex');
  assert.deepEqual(calls.map(call => call.command), [REMOTE_QUERY, INSTALL_EXTENSION, REMOTE_READY, REMOTE_QUERY]);
  assert.equal((calls.at(-1)!.argument as { includePublicIp: boolean }).includePublicIp, true);
  assert.deepEqual(phases, [true, false]);
});

test('已有兼容组件正常读取，CLI 认证或网络错误不会触发重装', async () => {
  for (const response of [reply(), { protocol: REMOTE_PROTOCOL, remoteName: 'ssh-remote', hostIp: '10.0.0.20', ok: false,
    message: 'do not expose SENSITIVE_MOCK_TOKEN', translation: message('rpcFailure', { method: 'account/read', code: -32000 }) }]) {
    let installs = 0;
    const support = new RemoteSupport(async command => { if (command === INSTALL_EXTENSION) installs++; return response; }, {});
    if (response.ok) assert.equal((await support.query('ssh-remote', 5000, new AbortController().signal, false, () => {})).hostIp, '10.0.0.20');
    else await assert.rejects(support.query('ssh-remote', 5000, new AbortController().signal, false, () => {}), /错误码 -32000/);
    assert.equal(installs, 0);
  }
});

test('安装失败使用固定分类提示，不暴露安装器的原始错误', async () => {
  const support = new RemoteSupport(async command => { if (command === INSTALL_EXTENSION) throw new Error('SENSITIVE_MOCK_TOKEN'); }, {});
  await assert.rejects(support.query('ssh-remote', 5000, new AbortController().signal, false, () => {}), error => {
    assert.equal((error as Error).message, fail('remoteInstallFailed').message); return true;
  });
});

test('并发安装只发起一次，取消一个等待者不影响另一个等待者', async () => {
  let complete!: () => void;
  let installs = 0;
  const support = new RemoteSupport(async command => { if (command === REMOTE_READY) return ready; installs++; await new Promise<void>(resolve => { complete = resolve; }); }, {});
  const controller = new AbortController();
  const cancelled = support.install(controller.signal);
  const second = support.install();
  controller.abort();
  await assert.rejects(cancelled, /已取消/);
  complete(); await second;
  assert.equal(installs, 1);
});

test('安装等待超时后保留正在进行的安装，再次等待不发起重复安装', async () => {
  let complete!: () => void, installs = 0;
  const support = new RemoteSupport(async command => { if (command === REMOTE_READY) return ready; installs++; await new Promise<void>(resolve => { complete = resolve; }); }, {}, 20, 20);
  await assert.rejects(support.install(), /安装等待超时/);
  await assert.rejects(support.install(), /安装等待超时/);
  assert.equal(installs, 1);
  const third = support.install(); complete(); await third;
});

test('组件安装后未注册命令会在时限内退出，禁止无限等待或重载', async () => {
  const calls: string[] = [];
  const support = new RemoteSupport(async command => { calls.push(command); }, {}, 1000, 20);
  await assert.rejects(support.install(), /尚未启用/);
  assert.equal(calls[0], INSTALL_EXTENSION);
  assert.ok(calls.slice(1).every(command => command === REMOTE_READY));
});

test('取消安装等待后不启动远程 CLI；已取消的请求不安装任何文件', async () => {
  let complete!: () => void;
  const calls: string[] = [];
  const support = new RemoteSupport(async command => {
    calls.push(command);
    if (command === INSTALL_EXTENSION) await new Promise<void>(resolve => { complete = resolve; });
    return command === REMOTE_READY ? ready : undefined;
  }, {});
  const controller = new AbortController();
  const query = support.query('ssh-remote', 5000, controller.signal, false, () => {});
  let failure: unknown; void query.catch(error => { failure = error; });
  for (let attempt = 0; attempt < 100 && !complete && !failure; attempt++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(complete, String(failure ?? 'installation must start'));
  controller.abort(); await assert.rejects(query, /已取消/);
  complete(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [REMOTE_QUERY, INSTALL_EXTENSION, REMOTE_READY]);
  await assert.rejects(support.install(controller.signal), /已取消/);
  assert.equal(calls.length, 3);
});
