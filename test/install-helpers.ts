import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

export async function npmFixture(home: string, scenario: unknown = {}): Promise<NodeJS.ProcessEnv> {
  const directory = path.join(home, 'npm with spaces');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(home, 'npm-scenario.json'), JSON.stringify(scenario));
  await writeFile(path.join(directory, process.platform === 'win32' ? 'npm.cmd' : 'npm'), 'Do not invoke this shell wrapper');
  const bin = path.join(directory, 'node_modules', 'npm', 'bin');
  await mkdir(bin, { recursive: true });
  // The official layout is represented by an entry that delegates to the offline peer.
  await writeFile(path.join(bin, 'npm-cli.js'), `require(${JSON.stringify(path.resolve(__dirname, '../../test/fixtures/npm-cli.js'))});\n`);
  if (process.platform === 'win32') {
    const compiler = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    await promisify(execFile)(compiler, ['/nologo', '/target:exe', `/out:${path.join(home, 'console-probe.exe')}`,
      path.resolve(__dirname, '../../test/fixtures/hidden-console.cs')], { windowsHide: true, timeout: 20_000 });
  }
  return { ...process.env, PATH: directory, CODEX_QUOTA_NPM_FIXTURE: home };
}
