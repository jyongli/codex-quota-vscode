import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createVSIX } from '@vscode/vsce';
const { version } = createRequire(import.meta.url)('../package.json');
await mkdir('artifacts', { recursive: true });
await createVSIX({
  packagePath: `artifacts/codex-quota-vscode-${version}.vsix`,
  dependencies: false,
  allowMissingRepository: false
});
