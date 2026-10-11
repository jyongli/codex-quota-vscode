import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { discoverSources, selectedSource } from '../src/sources';
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
