import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const fixtureCli = path.resolve(__dirname, '../../test/fixtures/codex.cjs');

export async function scenarioHome(scenario: unknown): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), 'codex-quota-test-'));
  await writeFile(path.join(home, 'scenario.json'), JSON.stringify(scenario));
  return home;
}

export async function readTrace(home: string): Promise<Record<string, unknown>[]> {
  return (await readFile(path.join(home, 'trace.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
}

export async function cleanup(home: string): Promise<void> { await rm(home, { recursive: true, force: true }); }
