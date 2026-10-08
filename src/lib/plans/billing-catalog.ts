import type { PlanCatalog } from "./plan-billing-core"

/** AXXES.dev API plans sold on AXXES Payments, by Stripe lookup key → catalog plan key. */
export const DEVELOPER_CATALOG: PlanCatalog = {
  product: "developer",
  planByLookupKey: {
    developer_build_monthly: "build",
    developer_build_annual: "build",
    developer_scale_monthly: "scale",
    developer_scale_annual: "scale",
  },
}

export function lookupKeyFor(plan: string, interval: string) {
  const key = `developer_${plan}_${interval === "annual" ? "annual" : "monthly"}`
  return key in DEVELOPER_CATALOG.planByLookupKey ? key : null
}

/** Only workspace owners and admins handle billing. */
export const canManageBilling = (role: string) => role === "owner" || role === "admin"
