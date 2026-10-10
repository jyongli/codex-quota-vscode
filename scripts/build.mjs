import { build } from 'esbuild';
await Promise.all([
  ['src/extension.ts', 'dist/extension.js'],
  ['src/remote.ts', 'remote-provider/dist/remote.js']
].map(([entry, outfile]) => build({
  entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs',
  target: 'node20', external: ['vscode'], minify: false, sourcemap: false, legalComments: 'none'
})));
