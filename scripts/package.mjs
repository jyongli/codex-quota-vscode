import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createVSIX } from '@vscode/vsce';
import { verifyIcon } from './verify-icon.mjs';
const { name, version, icon } = createRequire(import.meta.url)('../package.json');
// Reject an oversized icon before building a VSIX the gallery will refuse.
verifyIcon(await readFile(icon));
await mkdir('artifacts', { recursive: true });
await createVSIX({
  packagePath: `artifacts/${name}-${version}.vsix`,
  dependencies: false,
  allowMissingRepository: false
});
