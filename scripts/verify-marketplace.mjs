import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

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
assert.deepEqual(manifest.extensionKind, ['workspace']);
assert.ok(!manifest.enableProposedApi && !manifest.enabledApiProposals?.length, 'Proposed APIs are not allowed');
const files = await readZip(archive, () => true);
for (const name of ['extension/readme.md', 'extension/license.txt', 'extension/dist/extension.js',
  'extension/package.nls.json', 'extension/package.nls.zh-cn.json']) {
  assert.ok(files.get(name)?.length, `Missing ${name}`);
}
assert.ok([...files.keys()].every(name => !/(^|\/)(node_modules|test|auth\.json)(\/|$)/.test(name)));
assert.ok(![...files.keys()].some(name => name.includes('/bundled/') || name.includes('/remote-provider/')), 'The same extension must run on each installed host without a companion');
for (const key of ['cliPath', 'codexHome']) {
  assert.equal(manifest.contributes.configuration.properties[`codexQuota.${key}`].scope, 'machine');
}
console.log(`PASS: Marketplace package jyongli.codex-quota-vscode@${version}, one extension for local and remote installation`);
