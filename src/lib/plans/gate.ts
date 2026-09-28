import "server-only"
import { and, eq } from "drizzle-orm"
import { db, schema } from "@/lib/db"
import { PLANS, planAllows, planAllowsProduct, planByKey, type PlanDefinition } from "./catalog"

/**
 * The paywall.
 *
 * One function answers "may this workspace do this", and every surface calls
 * it: the gateway before serving a request, the portal before rendering a
 * locked screen, the docs before serving a reference. A paywall enforced in
 * three places separately is a paywall that eventually disagrees with itself,
 * and the disagreement is always in someone's favour.
 */
export type Gate = {
  plan: PlanDefinition
  allowed: (feature: string) => boolean
  productAllowed: (product: string) => boolean
  limitFor: <K extends keyof PlanDefinition["limits"]>(k: K) => number | null
  reason: (feature: string) => string | null
}

export async function gateFor(tenantId: string): Promise<Gate> {
  // The tenant row is the record of truth today; the subscriptions table is
  // where a paid plan will live. Reading both means the gate works on the
  // day the first customer upgrades, without a second code path.
  const [sub] = await db
    .select({ planKey: schema.subscriptions.planKey })
    .from(schema.subscriptions)
    .where(and(eq(schema.subscriptions.tenantId, tenantId), eq(schema.subscriptions.status, "active")))
    .limit(1)

  const [tenant] = await db
    .select({ tier: schema.tenants.subscriptionTier })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1)

  const key = sub?.planKey ?? tenant?.tier ?? "free"
  const plan = planByKey(key)

  return {
    plan,
    allowed: (feature) => planAllows(plan.key, feature),
    productAllowed: (product) => planAllowsProduct(plan.key, product),
    limitFor: (k) => plan.limits[k],
    reason: (feature) =>
      planAllows(plan.key, feature)
        ? null
        : `The ${plan.name} plan does not include this. Upgrade to reach it.`,
  }
}

/** What the upgrade page shows: the cheapest plan that unlocks this. */
export function cheapestPlanFor(feature: string): PlanDefinition | null {
  const ordered = [...PLANS]
  return ordered.find((p) => p.features.includes(feature)) ?? null
}
