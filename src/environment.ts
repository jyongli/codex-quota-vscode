import { networkInterfaces } from 'node:os';

export type ExecutionTarget = 'local' | 'remote';

export function activeTarget(workspaceHost: boolean, remoteName: string | undefined): ExecutionTarget {
  return workspaceHost && remoteName !== undefined ? 'remote' : 'local';
}

interface HostAddress { address: string; family: string | number; internal: boolean }

export function hostIpAddress(interfaces: Record<string, readonly HostAddress[] | undefined> = networkInterfaces()): string {
  const addresses = Object.values(interfaces).flatMap(entries => entries ?? []).filter(entry => !entry.internal);
  const ipv4 = addresses.filter(entry => entry.family === 'IPv4' || entry.family === 4);
  const selected = ipv4.length ? ipv4 : addresses.filter(entry => entry.family === 'IPv6' || entry.family === 6);
  return [...new Set(selected.map(entry => entry.address))].join('、') || '未获取到';
}
