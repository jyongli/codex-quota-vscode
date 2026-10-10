import { mkdir } from 'node:fs/promises';
import { createVSIX } from '@vscode/vsce';
await mkdir('artifacts', { recursive: true });
await createVSIX({
  packagePath: 'artifacts/codex-quota-vscode-0.1.0.vsix',
  dependencies: false,
  allowMissingRepository: false
});
