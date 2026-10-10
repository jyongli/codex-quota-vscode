import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicIpLookup, PUBLIC_IP_URL } from '../src/publicIp';

test('公网 IP 仅发送 HTTPS 查询，校验 IPv4/IPv6，缓存过期后重新获取', async () => {
  let time = 0;
  const calls: unknown[][] = [];
  let value = '203.0.113.7\n';
  const lookup = createPublicIpLookup(async (...args) => {
    calls.push(args); return new Response(value);
  }, () => time);
  assert.equal(await lookup(), '203.0.113.7');
  time = 299999;
  assert.equal(await lookup(), '203.0.113.7');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], PUBLIC_IP_URL);
  assert.deepEqual(Object.keys(calls[0][1] as object).sort(), ['credentials', 'redirect', 'signal']);
  assert.equal((calls[0][1] as RequestInit).credentials, 'omit');
  time = 300000; value = '2001:db8::7';
  assert.equal(await lookup(), value);
  assert.equal(calls.length, 2);
});

test('公网 IP 拒绝错误状态、HTML、无效地址与超大响应；失败只短暂缓存', async () => {
  for (const response of [new Response('203.0.113.1', { status: 503 }), new Response('<html>login</html>'),
    new Response('999.1.1.1'), new Response(' '.repeat(129) + '203.0.113.1')]) {
    let time = 0, calls = 0;
    const lookup = createPublicIpLookup(async () => { calls++; return calls === 1 ? response : new Response('203.0.113.8'); }, () => time);
    assert.equal(await lookup(), undefined);
    time = 29999; assert.equal(await lookup(), undefined); assert.equal(calls, 1);
    time = 30000; assert.equal(await lookup(), '203.0.113.8');
  }
  assert.equal(await createPublicIpLookup(async () => { throw new Error('offline'); })(), undefined);
});

test('公网 IP 网络和响应流超时可结束，取消请求不污染下一次缓存', async () => {
  let activeSignal: AbortSignal | undefined;
  const timeoutLookup = createPublicIpLookup(async (_url, init) => {
    activeSignal = init?.signal ?? undefined; return new Promise<Response>(() => {});
  }, Date.now, { timeoutMs: 20 });
  assert.equal(await timeoutLookup(), undefined);
  assert.equal(activeSignal?.aborted, true);
  let bodyCancelled = false;
  const streamLookup = createPublicIpLookup(async () => new Response(new ReadableStream({ cancel() { bodyCancelled = true; } })), Date.now, { timeoutMs: 20 });
  assert.equal(await streamLookup(), undefined);
  assert.equal(bodyCancelled, true);
  let calls = 0;
  const controller = new AbortController();
  const lookup = createPublicIpLookup(async (_url, init) => {
    calls++;
    if (calls > 1) return new Response('203.0.113.9');
    return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  });
  const pending = lookup(controller.signal); controller.abort();
  assert.equal(await pending, undefined);
  assert.equal(await lookup(), '203.0.113.9');
  assert.equal(calls, 2);
  assert.equal(await lookup(controller.signal), undefined);
  assert.equal(calls, 2);
});

test('不同查询宿主的公网 IP 缓存相互独立', async () => {
  const local = createPublicIpLookup(async () => new Response('203.0.113.10'));
  const remote = createPublicIpLookup(async () => new Response('198.51.100.20'));
  assert.deepEqual(await Promise.all([local(), remote(), local(), remote()]), ['203.0.113.10', '198.51.100.20', '203.0.113.10', '198.51.100.20']);
});

test('旧公网 IP 过期后查询失败，不继续显示过期地址', async () => {
  let time = 0, calls = 0;
  const lookup = createPublicIpLookup(async () => {
    if (calls++ === 0) return new Response('203.0.113.12');
    throw new Error('offline');
  }, () => time);
  assert.equal(await lookup(), '203.0.113.12');
  time = 300000;
  assert.equal(await lookup(), undefined);
  time = 300001;
  assert.equal(await lookup(), undefined);
  assert.equal(calls, 2);
});
