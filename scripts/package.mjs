import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createVSIX } from '@vscode/vsce';
const { version } = createRequire(import.meta.url)('../package.json');
const remoteManifest = createRequire(import.meta.url)('../remote-provider/package.json');
if (remoteManifest.version !== version) throw new Error('主插件与远程组件版本必须一致。');
await mkdir('artifacts', { recursive: true });
await createVSIX({
  packagePath: `artifacts/codex-quota-vscode-${version}.vsix`,
  dependencies: false,
  allowMissingRepository: false
});
