import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const directory = new URL('../out/test/', import.meta.url);
// Discover current source files so obsolete compiled tests from an earlier
// checkout cannot run after a test or component has been removed.
const files = (await readdir(new URL('../test/', import.meta.url))).filter(name => name.endsWith('.test.ts')).sort()
  .map(name => fileURLToPath(new URL(name.replace(/\.ts$/, '.js'), directory)));
if (!files.length) throw new Error('No compiled unit tests found.');
const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], {
  encoding: 'utf8', maxBuffer: 2 * 1024 * 1024
});
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error) console.error(result.error.message);
if (result.status !== 0 && process.env.GITHUB_ACTIONS === 'true') {
  const diagnostic = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.slice(-16000)
    .replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.error(`::error title=Unit test failure::${diagnostic}`);
}
process.exitCode = result.status ?? 1;
