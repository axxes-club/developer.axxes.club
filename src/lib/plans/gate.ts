import "server-only"
import { loadHostingPolicy } from "@/lib/deploy/exemptions"
import type { HostingPolicy } from "@/lib/deploy/types"
import { and, eq, inArray, sql } from "drizzle-orm"
import { db, schema } from "@/lib/db"
import {
  PLANS,
  planAllows,
  planAllowsProduct,
  planByKey,
  topPlan,
  unlimitedFrom,
  type PlanDefinition,
} from "./catalog"

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
  /**
   * True when a superadmin in this workspace is being served the top tier with
   * no ceilings. Every caller that bills, meters or rate-limits should read
   * this rather than inspecting the plan: the plan alone cannot say whether a
   * limit is a real limit or an exempt one.
   */
  exempt: boolean
  /** Explicit hosting grants; independent of the legacy API exemption. */
  hostingFor: (projectId: string) => Promise<HostingPolicy>
  allowed: (feature: string) => boolean
  productAllowed: (product: string) => boolean
  limitFor: <K extends keyof PlanDefinition["limits"]>(k: K) => number | null
  reason: (feature: string) => string | null
}

export async function gateFor(tenantId: string): Promise<Gate> {
  // A superadmin in the workspace gets the top tier with every ceiling
  // removed, and is never charged for it. Checked first and in the same round
  // trip, because an exempt owner hitting a paywall is the worst possible
  // failure for this function — it would lock AXXES out of AXXES.
  const [membership] = await db
    .select({
      isSuperadmin: schema.user.isSuperadmin,
      planKey: schema.subscriptions.planKey,
      tier: schema.tenants.subscriptionTier,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.tenantMemberships.tenantId))
    .leftJoin(
      schema.subscriptions,
      and(
        eq(schema.subscriptions.tenantId, tenantId),
        // Paid access continues through a trial and while Stripe retries a failed card.
        inArray(schema.subscriptions.status, ["active", "trialing", "past_due"]),
        sql`(${schema.subscriptions.currentPeriodEnd} is null or ${schema.subscriptions.currentPeriodEnd} >= now())`,
      ),
    )
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        sql`${schema.tenantMemberships.deletedAt} is null`,
      ),
    )
    .limit(1)

  const hasSuperadmin = await hasSuperadminIn(tenantId)

  // Billing and metering still record the work — an exempt account is not an
  // invisible one — but nothing is charged and nothing is refused.
  const plan = hasSuperadmin
    ? unlimitedFrom(topPlan())
    : planByKey(membership?.planKey ?? membership?.tier ?? "free")

  return {
    plan,
    exempt: hasSuperadmin,
    hostingFor: (projectId) => loadHostingPolicy({ tenantId, projectId }),
    allowed: (feature) => hasSuperadmin || planAllows(plan.key, feature),
    productAllowed: (product) => hasSuperadmin || planAllowsProduct(plan.key, product),
    limitFor: (k) => (hasSuperadmin ? null : plan.limits[k]),
    reason: (feature) =>
      hasSuperadmin || planAllows(plan.key, feature)
        ? null
        : `The ${plan.name} plan does not include this. Upgrade to reach it.`,
  }
}

/** Does anyone in this workspace hold superadmin? */
async function hasSuperadminIn(tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        sql`${schema.tenantMemberships.deletedAt} is null`,
        eq(schema.user.isSuperadmin, true),
      ),
    )
  return (row?.n ?? 0) > 0
}

/** What the upgrade page shows: the cheapest plan that unlocks this. */
export function cheapestPlanFor(feature: string): PlanDefinition | null {
  const ordered = [...PLANS]
  return ordered.find((p) => p.features.includes(feature)) ?? null
}
