import { build } from 'esbuild';
import { createVSIX } from '@vscode/vsce';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
if (require('../package.json').version !== require('../remote-provider/package.json').version) {
  throw new Error('主插件与内置远程组件版本必须一致。');
}
await Promise.all([
  ['src/extension.ts', 'dist/extension.js'],
  ['src/remote.ts', 'remote-provider/dist/remote.js']
].map(([entry, outfile]) => build({
  entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs',
  target: 'node20', external: ['vscode'], minify: false, sourcemap: false, legalComments: 'none'
})));
await mkdir('bundled', { recursive: true });
await createVSIX({ cwd: path.resolve('remote-provider'), packagePath: path.resolve('bundled/remote.vsix'),
  dependencies: false, allowMissingRepository: false });
