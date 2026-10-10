import { networkInterfaces } from 'node:os';

export type ExecutionTarget = 'local' | 'remote';
export type ExtensionKinds = Record<string, readonly string[]>;

export function activeTarget(workspaceHost: boolean, remoteName: string | undefined): ExecutionTarget {
  return workspaceHost && remoteName !== undefined ? 'remote' : 'local';
}

export function selectedTarget(kinds: ExtensionKinds, extensionId: string): ExecutionTarget {
  return kinds[extensionId]?.[0] === 'workspace' ? 'remote' : 'local';
}

export function withTarget(kinds: ExtensionKinds, extensionId: string, target: ExecutionTarget): ExtensionKinds {
  return { ...kinds, [extensionId]: [target === 'local' ? 'ui' : 'workspace'] };
}

export function hostLabel(target: ExecutionTarget, remoteName?: string): string {
  return target === 'local' ? '本地' : `远程${remoteName ? ` / ${remoteName}` : ''}`;
}

interface HostAddress { address: string; family: string | number; internal: boolean }

export function hostIpAddress(interfaces: Record<string, readonly HostAddress[] | undefined> = networkInterfaces()): string {
  const addresses = Object.values(interfaces).flatMap(entries => entries ?? []).filter(entry => !entry.internal);
  const ipv4 = addresses.filter(entry => entry.family === 'IPv4' || entry.family === 4);
  const selected = ipv4.length ? ipv4 : addresses.filter(entry => entry.family === 'IPv6' || entry.family === 6);
  return [...new Set(selected.map(entry => entry.address))].join('、') || '未获取到';
}
