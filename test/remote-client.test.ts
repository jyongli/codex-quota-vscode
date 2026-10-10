import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryRemote } from '../src/remoteClient';
import { REMOTE_CANCEL, REMOTE_PROTOCOL, REMOTE_QUERY, RemoteReply } from '../src/remoteProtocol';

const response = (): RemoteReply => ({
  protocol: REMOTE_PROTOCOL, remoteName: 'ssh-remote', hostIp: '10.20.30.40', ok: true,
  snapshot: { account: { type: 'signedOut' }, cliPath: '/remote/bin/codex', codexHome: '/remote/.codex', checkedAt: '2026-10-10T00:00:00Z' }
});

test('远程协议传回远程路径、IP 和日期，拒绝其他宿主或不兼容组件', async () => {
  const controller = new AbortController();
  const snapshot = await queryRemote(async () => response(), 'ssh-remote', 5000, controller.signal);
  assert.equal(snapshot.hostIp, '10.20.30.40');
  assert.equal(snapshot.codexHome, '/remote/.codex');
  assert.ok(snapshot.checkedAt instanceof Date);
  await assert.rejects(queryRemote(async () => ({ ...response(), remoteName: null }), 'ssh-remote', 5000, controller.signal), /当前远程宿主/);
  await assert.rejects(queryRemote(async () => ({ ...response(), protocol: 0 }), 'ssh-remote', 5000, controller.signal), /版本不兼容/);
  await assert.rejects(queryRemote(async () => undefined, 'ssh-remote', 5000, controller.signal), /未安装/);
});

test('取消远程请求使用同一请求 ID，晚到响应不会覆盖取消结果', async () => {
  const controller = new AbortController();
  const calls: { command: string; id: string }[] = [];
  let complete!: (value: RemoteReply) => void;
  const query = queryRemote(async (command, value) => {
    const request = value as { requestId: string };
    calls.push({ command, id: request.requestId });
    if (command === REMOTE_QUERY) return new Promise<RemoteReply>(resolve => { complete = resolve; });
    return undefined;
  }, 'ssh-remote', 5000, controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(query, /已取消/);
  complete(response());
  assert.deepEqual(calls.map(call => call.command), [REMOTE_QUERY, REMOTE_CANCEL]);
  assert.equal(calls[0].id, calls[1].id);
});
