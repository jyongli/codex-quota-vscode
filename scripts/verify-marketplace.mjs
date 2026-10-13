import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { verifyIcon } from './verify-icon.mjs';

// VSCE is pinned in package-lock.json; use its own VSIX manifest parser.
const require = createRequire(import.meta.url);
const { readVSIXPackage, readZip } = require('@vscode/vsce/out/zip');
const semver = require('semver');
const [archive, version] = process.argv.slice(2);
assert.ok(archive && semver.valid(version) && !semver.prerelease(version), 'Specify an archive and stable version');
const { manifest, xmlManifest } = await readVSIXPackage(archive);
assert.equal(manifest.publisher, 'ujyong');
assert.equal(manifest.name, 'codex-quota-monitor-ujyong');
assert.equal(manifest.version, version);
const identity = xmlManifest.PackageManifest.Metadata[0].Identity[0].$;
assert.equal(identity.Publisher, manifest.publisher, 'VSIX publisher must match package.json');
assert.equal(identity.Id, manifest.name);
assert.equal(identity.Version, manifest.version);
assert.deepEqual(manifest.extensionKind, ['workspace']);
assert.ok(!manifest.enableProposedApi && !manifest.enabledApiProposals?.length, 'Proposed APIs are not allowed');
const files = await readZip(archive, () => true);
for (const name of ['extension/readme.md', 'extension/license.txt', 'extension/dist/extension.js',
  'extension/package.nls.json', 'extension/package.nls.zh-cn.json']) {
  assert.ok(files.get(name)?.length, `Missing ${name}`);
}
assert.equal(manifest.icon, 'resources/icon.png');
const icon = files.get(`extension/${manifest.icon}`);
const { bytes: iconBytes } = verifyIcon(icon);
const descriptions = JSON.parse(files.get('extension/package.nls.json').toString());
assert.equal(descriptions['main.description'], 'Show Codex 5-hour and weekly quota usage in the VS Code status bar.');
assert.ok([...files.keys()].every(name => !/(^|\/)(node_modules|test|auth\.json)(\/|$)/.test(name)));
assert.ok(![...files.keys()].some(name => name.includes('/bundled/') || name.includes('/remote-provider/')), 'The same extension must run on each installed host without a companion');
for (const key of ['cliPath', 'codexHome']) {
  assert.equal(manifest.contributes.configuration.properties[`codexQuota.${key}`].scope, 'machine');
}
console.log(`PASS: Marketplace package ${manifest.publisher}.${manifest.name}@${version}, icon ${iconBytes} bytes (limit 1024 KB), one extension for local and remote installation`);
