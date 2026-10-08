import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import { ACCESS_STATUSES, listSubscriptions, type SubscriptionSnapshot } from "@/lib/axxes-payments"
import { effectiveSnapshot, mayWrite, ownsPlan, planKeyFor, rowIsLive, type PlanCatalog } from "./plan-billing-core"

/**
 * Writes AXXES Payments subscription state into the shared, members-owned `subscriptions`
 * row for a workspace (one row per tenant; reference = tenant ID). Several products read
 * that row (gateFor, Vitrine), so a product only writes when the row is empty, lapsed, or
 * already one of its own plans; it never replaces another product's live plan.
 */
export type { PlanCatalog }

/** Whether this product may sell to the workspace, and the plan it is on now if it is live. */
export async function canSellTo(tenantId: string, catalog: PlanCatalog) {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1)
  const current = row && rowIsLive(row) && row.planKey && row.planKey !== "free" ? row.planKey : null
  return { ok: mayWrite(row, catalog), current, own: ownsPlan(catalog, current) }
}

export async function applyPlanSnapshot(snapshot: SubscriptionSnapshot, catalog: PlanCatalog, others?: SubscriptionSnapshot[]) {
  if (snapshot.product !== catalog.product) return
  const tenantId = snapshot.reference
  const effective = ACCESS_STATUSES.includes(snapshot.status)
    ? snapshot
    : effectiveSnapshot(snapshot, others ?? (await listSubscriptions(tenantId)))
  const planKey = planKeyFor(catalog, effective)
  if (!planKey) return
  const values = {
    planKey,
    status: effective.status,
    currentPeriodEnd: effective.current_period_end ? new Date(effective.current_period_end * 1000) : null,
    updatedAt: new Date(),
  }
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1).for("update")
    if (!row) {
      await tx.insert(subscriptions).values({ tenantId, ...values })
      return
    }
    if (!mayWrite(row, catalog)) {
      console.error("plan_conflict", { tenantId, product: catalog.product, existing: row.planKey })
      return
    }
    await tx.update(subscriptions).set(values).where(eq(subscriptions.id, row.id))
  })
}
