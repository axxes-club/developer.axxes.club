import type {HostingPolicy} from "./types"
export class HostingAccessError extends Error {
  constructor() {
    super("Hosting access denied")
    this.name = "HostingAccessError"
  }
}
export function requireHostingAccess(
  ctx: { role: string; userId?:string },
  operation: "inspect" | "usage" | "billing" | "deploy",
  deployment?:{policy:HostingPolicy;freeOwnerUserId:string|null},
): void {
  const roles: Record<typeof operation, readonly string[]> = {
    inspect: ["owner", "admin"],
    billing: ["owner", "admin"],
    deploy: ["owner", "admin", "manager"],
    usage: ["owner", "admin", "manager", "member", "viewer"],
  }
  if (!roles[operation]?.includes(ctx.role)) throw new HostingAccessError()
  if(operation==='deploy'){
    if(!ctx.userId||!deployment)throw new HostingAccessError()
    if(deployment.policy.exempt&&(!deployment.freeOwnerUserId||ctx.userId!==deployment.freeOwnerUserId))throw new HostingAccessError()
  }
}
