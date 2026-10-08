// Pure rules for writing AXXES Payments plans into the shared `subscriptions` row. No I/O, so they are unit-tested.
const ACCESS = ["trialing", "active", "past_due"]

export type PlanCatalog = { product: string; planByLookupKey: Record<string, string> }
export type SharedRow = { planKey: string | null; status: string; currentPeriodEnd: Date | null }
type Snapshot = { id: string; status: string; lookup_key: string | null }

export const rowIsLive = (row: SharedRow, now = Date.now()) =>
  ACCESS.includes(row.status) && (!row.currentPeriodEnd || row.currentPeriodEnd.getTime() >= now)

export const ownsPlan = (catalog: PlanCatalog, planKey: string | null) =>
  !!planKey && Object.values(catalog.planByLookupKey).includes(planKey)

/** Another product's live paid plan is never replaced; empty, free, lapsed or own rows may be written. */
export function mayWrite(row: SharedRow | undefined, catalog: PlanCatalog, now = Date.now()) {
  if (!row || !row.planKey || row.planKey === "free" || !rowIsLive(row, now)) return true
  return ownsPlan(catalog, row.planKey)
}

/** An ended subscription must not close access that another live subscription still pays for. */
export function effectiveSnapshot<T extends Snapshot>(snapshot: T, others: T[]): T {
  if (ACCESS.includes(snapshot.status)) return snapshot
  return others.find((s) => s.id !== snapshot.id && ACCESS.includes(s.status)) ?? snapshot
}

export const planKeyFor = (catalog: PlanCatalog, snapshot: Snapshot) =>
  (snapshot.lookup_key && catalog.planByLookupKey[snapshot.lookup_key]) || null
