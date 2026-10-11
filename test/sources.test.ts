import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalHome, discoverSources, mergeEquivalentSources, QuerySource, selectedSource } from '../src/sources';
import { cleanup, scenarioHome } from './helpers';

test('仅发现当前宿主可查询的官方 IDE 程序，Windows WSL 与其他宿主不混用本机账号', async () => {
  const root = await scenarioHome({});
  try {
    const binary = path.join(root, 'bin', 'linux-x86_64', 'codex');
    await mkdir(path.dirname(binary), { recursive: true });
    await writeFile(binary, 'fixture'); await chmod(binary, 0o755);
    const ide = { path: root, sameHost: true, usesWsl: false };
    const sources = await discoverSources('codex', path.join(root, 'cli-home'), [], ide, 'linux', 'x64');
    assert.equal(sources.length, 2);
    assert.equal(sources[1].cliPath, binary);
    assert.notEqual(sources[1].codexHome, sources[0].codexHome);
    assert.equal((await discoverSources('codex', '', [], { ...ide, sameHost: false }, 'linux', 'x64')).length, 1);
    assert.equal((await discoverSources('codex', '', [], { ...ide, usesWsl: true }, 'win32', 'x64')).length, 1);
    assert.equal((await discoverSources('codex', '', [], { ...ide, cliPath: path.join(root, 'missing') }, 'linux', 'x64')).length, 1);
  } finally { await cleanup(root); }
});

test('实际目录解析继承 CODEX_HOME、符号链接与路径规范化；保留查询目录', async () => {
  const root = await scenarioHome({});
  const previousHome = process.env.CODEX_HOME;
  try {
    process.env.CODEX_HOME = root;
    const directory = path.join(root, '.codex');
    const link = path.join(root, 'linked');
    await mkdir(directory);
    await symlink(directory, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(await canonicalHome(''), await realpath(root));
    assert.equal(await canonicalHome(link + path.sep), await realpath(directory));
    const sources = await discoverSources('codex', link, [{ name: 'Same', codexHome: directory }]);
    assert.equal(sources[0].codexHome, link, 'a credential-store path must not be silently replaced');
    assert.equal(sources[0].resolvedHome, sources[1].resolvedHome);
  } finally {
    if (previousHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previousHome;
    await cleanup(root);
  }
});

const sameAccount = { type: 'chatgpt' as const, email: 'same@example.test', planType: 'plus' };
const pair = (home: string): QuerySource[] => [
  { id: 'cli', kind: 'cli', cliPath: 'codex', codexHome: home },
  { id: 'ide', kind: 'ide', cliPath: '/ide/codex', codexHome: home }
];

test('实际目录与登录账号同时一致才合并；已保存的 IDE 别名仍能选择合并来源', async () => {
  const root = await scenarioHome({});
  try {
    const sources = [...pair(root), { ...pair(path.join(root, 'other'))[0], id: 'environment:Other' }];
    const merged = await mergeEquivalentSources(sources, async source => ({ account: sameAccount, codexHome: source.codexHome }));
    assert.equal(merged.length, 2);
    assert.deepEqual(merged[0].aliases, ['cli', 'ide']);
    assert.equal(merged[0].includesIde, true);
    assert.equal(selectedSource(merged, 'ide'), merged[0]);
    assert.equal(selectedSource(merged, undefined), undefined);
    assert.equal(selectedSource(merged.slice(0, 1), undefined), merged[0]);
  } finally { await cleanup(root); }
});

test('目录不同、账号不同或账号无法确认时保留独立来源；未登录状态可以合并', async () => {
  const home = process.platform === 'win32' ? 'C:\\codex-fixture' : '/codex-fixture';
  for (const account of [{ ...sameAccount, email: 'different@example.test' }, { ...sameAccount, planType: 'pro' },
    { type: 'chatgpt' as const, email: null, planType: 'plus' }, { type: 'apiKey' as const }]) {
    const merged = await mergeEquivalentSources(pair(home), async source => ({ account: source.id === 'cli' ? sameAccount : account, codexHome: home }));
    assert.equal(merged.length, 2);
  }
  assert.equal((await mergeEquivalentSources(pair(home), async () => undefined)).length, 2);
  assert.equal((await mergeEquivalentSources(pair(home), async source => ({ account: sameAccount,
    codexHome: source.id === 'cli' ? home : path.join(home, 'other') }))).length, 2);
  assert.equal((await mergeEquivalentSources(pair(home), async () => ({ account: { type: 'signedOut' }, codexHome: home }))).length, 1);
});

test('Windows 实际路径忽略大小写和分隔符，POSIX 路径区分大小写', async () => {
  const windows = await mergeEquivalentSources(pair('C:\\Users\\Fixture\\.codex'), async source => ({ account: sameAccount,
    codexHome: source.id === 'cli' ? 'C:\\Users\\Fixture\\.codex\\' : 'c:/users/fixture/.codex' }), 'win32');
  assert.equal(windows.length, 1);
  assert.match(windows[0].resolvedHome!, /Users\\Fixture/);
  const posix = await mergeEquivalentSources(pair('/fixture/.codex'), async source => ({ account: sameAccount,
    codexHome: source.id === 'cli' ? '/fixture/.codex' : '/Fixture/.codex' }), 'linux');
  assert.equal(posix.length, 2);
});

test('多个来源必须选择，单个来源自动显示；配置环境拒绝相对路径、重名与控制字符', async () => {
  const root = await scenarioHome({});
  try {
    const sources = await discoverSources('codex', '', [
      { name: 'Work', codexHome: root }, { name: 'Work', codexHome: root },
      { name: 'Relative', codexHome: './untrusted' }, { name: '\nInjected', codexHome: root },
      { name: 'Invalid\nname', codexHome: root }, { name: '', codexHome: root }, null
    ]);
    // Leading/trailing whitespace is trimmed; embedded control characters are rejected.
    assert.deepEqual(sources.map(source => source.id), ['cli', 'environment:Work', 'environment:Injected']);
    assert.equal(selectedSource(sources, undefined), undefined);
    assert.equal(selectedSource(sources, 'removed'), undefined);
    assert.equal(selectedSource(sources, 'environment:Work')?.codexHome, root);
    assert.equal(selectedSource(sources.slice(0, 1), 'removed')?.id, 'cli');
  } finally { await cleanup(root); }
});
