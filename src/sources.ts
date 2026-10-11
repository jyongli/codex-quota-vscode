import { access, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { expandHome, Snapshot } from './cli';
import { Account, record } from './quota';

export interface QuerySource {
  id: string;
  kind: 'cli' | 'ide';
  name?: string;
  cliPath: string;
  codexHome: string;
  resolvedHome?: string;
  account?: Account;
  aliases?: string[];
  includesIde?: boolean;
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
  if (!ide?.sameHost || (platform === 'win32' && ide.usesWsl)) return resolveHomes(sources, platform);
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
  return resolveHomes(sources, platform);
}

export async function canonicalHome(home: string, platform = process.platform): Promise<string> {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const configured = expandHome(home.trim()) || process.env.CODEX_HOME || path.join(homedir(), '.codex');
  let resolved = configured;
  if (paths.isAbsolute(configured)) {
    try { resolved = await realpath(configured); } catch { /* Preserve inaccessible/nonexistent paths for diagnostics. */ }
  }
  // Preserve the actual path for display. Comparison is case-insensitive on
  // Windows; never override the directory supplied to the credential store.
  resolved = paths.normalize(resolved);
  if (resolved !== paths.parse(resolved).root) resolved = resolved.replace(platform === 'win32' ? /[\\/]+$/ : /\/+$/, '');
  return resolved;
}

async function resolveHomes(sources: QuerySource[], platform: NodeJS.Platform): Promise<QuerySource[]> {
  return Promise.all(sources.map(async source => ({ ...source, resolvedHome: await canonicalHome(source.codexHome, platform) })));
}

function accountIdentity(account: Account | undefined): string | undefined {
  if (account?.type === 'signedOut') return 'signedOut';
  if (account?.type === 'chatgpt' && account.email?.trim()) {
    return JSON.stringify([account.type, account.email, account.planType]);
  }
  // API keys/Bedrock and a missing email do not reveal an account identity.
  return undefined;
}

export async function mergeEquivalentSources(sources: QuerySource[],
  probe: (source: QuerySource) => Promise<Pick<Snapshot, 'account' | 'codexHome'> | undefined>,
  platform = process.platform): Promise<QuerySource[]> {
  if (sources.length <= 1) return sources;
  const merged: QuerySource[] = [];
  const byIdentity = new Map<string, QuerySource>();
  for (const source of sources) {
    const snapshot = await probe(source);
    const resolvedHome = snapshot ? await canonicalHome(snapshot.codexHome, platform) : source.resolvedHome;
    const identity = accountIdentity(snapshot?.account);
    const paths = platform === 'win32' ? path.win32 : path.posix;
    const comparableHome = platform === 'win32' ? resolvedHome?.toLowerCase() : resolvedHome;
    const key = resolvedHome && paths.isAbsolute(resolvedHome) && identity ? JSON.stringify([comparableHome, identity]) : undefined;
    const existing = key ? byIdentity.get(key) : undefined;
    if (existing) {
      existing.aliases!.push(source.id);
      if (source.kind === 'ide') existing.includesIde = true;
    } else {
      const entry = { ...source, resolvedHome, account: snapshot?.account, aliases: [source.id] };
      merged.push(entry);
      if (key) byIdentity.set(key, entry);
    }
  }
  return merged;
}

export function selectedSource(sources: readonly QuerySource[], selection: string | undefined): QuerySource | undefined {
  return sources.length === 1 ? sources[0] : sources.find(source => source.id === selection || source.aliases?.includes(selection ?? ''));
}
