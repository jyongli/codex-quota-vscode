import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { expandHome } from './cli';
import { record } from './quota';

export interface QuerySource {
  id: string;
  kind: 'cli' | 'ide';
  name?: string;
  cliPath: string;
  codexHome: string;
}

export interface IdeInstallation {
  path: string;
  sameHost: boolean;
  cliPath?: string;
  usesWsl: boolean;
}

// Only discover accounts accessible to this extension host. A path belonging to
// another host must never be interpreted as a local path or queried as CLI.
export async function discoverSources(cliPath: string, codexHome: string, environments: unknown,
  ide?: IdeInstallation, platform = process.platform, arch = process.arch): Promise<QuerySource[]> {
  const sources: QuerySource[] = [{ id: 'cli', kind: 'cli', cliPath, codexHome }];
  if (Array.isArray(environments)) {
    const names = new Set<string>();
    for (const entry of environments.slice(0, 20)) {
      if (!record(entry) || typeof entry.name !== 'string' || typeof entry.codexHome !== 'string') continue;
      const name = entry.name.trim();
      const home = expandHome(entry.codexHome.trim());
      if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) || names.has(name) || !path.isAbsolute(home)) continue;
      names.add(name);
      sources.push({ id: `environment:${name}`, kind: 'cli', name, codexHome: home,
        cliPath: typeof entry.cliPath === 'string' && entry.cliPath.trim() ? entry.cliPath.trim() : cliPath });
    }
  }
  if (!ide?.sameHost || (platform === 'win32' && ide.usesWsl)) return sources;
  const system = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : platform === 'linux' ? 'linux' : undefined;
  const architecture = arch === 'x64' ? 'x86_64' : arch === 'arm64' ? 'aarch64' : undefined;
  const executable = platform === 'win32' ? 'codex.exe' : 'codex';
  const candidates = ide.cliPath ? [expandHome(ide.cliPath.trim())] : [
    ...(system && architecture ? [path.join(ide.path, 'bin', `${system}-${architecture}`, executable)] : []),
    path.join(ide.path, 'bin', executable)
  ];
  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate)) continue;
    try {
      await access(candidate, platform === 'win32' || /\.[cm]?js$/i.test(candidate) ? constants.F_OK : constants.X_OK);
      sources.push({ id: 'ide', kind: 'ide', cliPath: candidate,
        codexHome: process.env.CODEX_HOME || path.join(homedir(), '.codex') });
      break;
    } catch { /* An unavailable IDE executable is not a queryable source. */ }
  }
  return sources;
}

export function selectedSource(sources: readonly QuerySource[], selection: string | undefined): QuerySource | undefined {
  return sources.length === 1 ? sources[0] : sources.find(source => source.id === selection);
}
