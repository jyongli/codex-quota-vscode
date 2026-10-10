import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

// VSCE is pinned in package-lock.json; use its own VSIX manifest parser.
const require = createRequire(import.meta.url);
const { readVSIXPackage, readZip } = require('@vscode/vsce/out/zip');
const semver = require('semver');
const [archive, version] = process.argv.slice(2);
assert.ok(archive && semver.valid(version) && !semver.prerelease(version), 'Specify an archive and stable version');
const { manifest } = await readVSIXPackage(archive);
assert.equal(manifest.publisher, 'jyongli');
assert.equal(manifest.name, 'codex-quota-vscode');
assert.equal(manifest.version, version);
assert.deepEqual(manifest.extensionKind, ['ui']);
assert.ok(!manifest.enableProposedApi && !manifest.enabledApiProposals?.length, 'Proposed APIs are not allowed');
const files = await readZip(archive, () => true);
for (const name of ['extension/readme.md', 'extension/license.txt', 'extension/dist/extension.js',
  'extension/package.nls.json', 'extension/package.nls.zh-cn.json', 'extension/bundled/remote.vsix']) {
  assert.ok(files.get(name)?.length, `Missing ${name}`);
}
assert.ok([...files.keys()].every(name => !/(^|\/)(node_modules|test|auth\.json)(\/|$)/.test(name)));
const temporary = await mkdtemp(path.join(tmpdir(), 'codex-quota-marketplace-'));
try {
  const embedded = path.join(temporary, 'remote.vsix');
  await writeFile(embedded, files.get('extension/bundled/remote.vsix'));
  const remote = (await readVSIXPackage(embedded)).manifest;
  assert.equal(remote.publisher, manifest.publisher);
  assert.equal(remote.name, 'codex-quota-remote');
  assert.equal(remote.version, manifest.version);
  assert.deepEqual(remote.extensionKind, ['workspace']);
  assert.ok(remote.activationEvents.includes('onCommand:codexQuota.remote.ready'));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.log(`PASS: Marketplace package jyongli.codex-quota-vscode@${version}, including embedded remote support`);
