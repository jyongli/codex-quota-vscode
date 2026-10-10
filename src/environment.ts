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
