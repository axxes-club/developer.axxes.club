export class HostingAccessError extends Error { constructor() { super('Hosting access denied'); this.name = 'HostingAccessError' } }
export function requireHostingAccess(ctx: {role: string}, operation: 'inspect' | 'usage' | 'billing' | 'deploy'): void {
  const roles: Record<typeof operation, readonly string[]> = {
    inspect: ['owner','admin'], billing: ['owner','admin'],
    deploy: ['owner','admin','manager'], usage: ['owner','admin','manager','member','viewer'],
  }
  if (!roles[operation]?.includes(ctx.role)) throw new HostingAccessError()
}
