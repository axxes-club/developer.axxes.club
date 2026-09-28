import "server-only"
import { and, desc, eq, gte, sql } from "drizzle-orm"
import { db, schema } from "@/lib/db"
import { gateFor } from "@/lib/plans/gate"

/**
 * Metering.
 *
 * Every served call produces one usage row. That is deliberately more work
 * than keeping a counter: a counter answers "how much did we serve" but not
 * "to whom, which endpoint, failing how often, at what latency", and those
 * are the questions a customer disputes a bill over and an auditor asks.
 * Rows roll up into usage_daily so the common read stays cheap.
 *
 * Writing usage must never be the reason a request fails, so record() is
 * best-effort and says so.
 */
export type UsageRecord = {
  tenantId: string
  appId?: string | null
  keyId?: string | null
  product: string
  endpoint: string
  method: string
  status: number
  billable?: boolean
  latencyMs?: number
  bytesIn?: number
  errorCode?: string | null
}

export async function record(input: UsageRecord): Promise<void> {
  try {
    await db.insert(schema.usageEvents).values({
      tenantId: input.tenantId,
      appId: input.appId ?? null,
      keyId: input.keyId ?? null,
      product: input.product,
      endpoint: input.endpoint,
      method: input.method,
      status: input.status,
      // A 5xx is our fault and is not billed; a 4xx is the caller's.
      billable: input.billable ?? (input.status < 500 && input.status < 400),
      latencyMs: input.latencyMs ?? null,
      bytesIn: input.bytesIn ?? null,
      errorCode: input.errorCode ?? null,
    })
  } catch (error) {
    // Swallowed on purpose. Losing a metering row is bad; failing a
    // customer's request because we could not record it is worse.
    console.error("usage record failed:", error)
  }
}

export type UsageSummary = {
  period: { from: Date; to: Date }
  total: number
  errors: number
  errorRate: number
  p95LatencyMs: number | null
  byProduct: { product: string; calls: number; errors: number }[]
  byApp: { appId: string | null; name: string; calls: number; errors: number }[]
  daily: { day: string; calls: number; errors: number }[]
  /** What the plan allows, so the page can say "312 of 1,000 used". */
  allowance: { used: number; limit: number | null }
}

export async function summarise(
  tenantId: string,
  opts: { from?: Date; to?: Date } = {},
): Promise<UsageSummary> {
  const to = opts.to ?? new Date()
  const from =
    opts.from ??
    new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - 29))
  const window = and(eq(schema.usageEvents.tenantId, tenantId), gte(schema.usageEvents.occurredAt, from))

  const [totals] = await db
    .select({
      calls: sql<number>`count(*)::int`,
      errors: sql<number>`count(*) filter (where ${schema.usageEvents.status} >= 400)::int`,
      p95: sql<number | null>`percentile_cont(0.95) within group (order by ${schema.usageEvents.latencyMs})::int`,
    })
    .from(schema.usageEvents)
    .where(window)

  const byProduct = await db
    .select({
      product: schema.usageEvents.product,
      calls: sql<number>`count(*)::int`,
      errors: sql<number>`count(*) filter (where ${schema.usageEvents.status} >= 400)::int`,
    })
    .from(schema.usageEvents)
    .where(window)
    .groupBy(schema.usageEvents.product)
    .orderBy(desc(sql`count(*)`))

  const byApp = await db
    .select({
      appId: schema.usageEvents.appId,
      name: sql<string>`coalesce(${schema.apps.name}, 'unattributed')`,
      calls: sql<number>`count(*)::int`,
      errors: sql<number>`count(*) filter (where ${schema.usageEvents.status} >= 400)::int`,
    })
    .from(schema.usageEvents)
    .leftJoin(schema.apps, eq(schema.apps.id, schema.usageEvents.appId))
    .where(window)
    .groupBy(schema.usageEvents.appId, sql`coalesce(${schema.apps.name}, 'unattributed')`)
    .orderBy(desc(sql`count(*)`))

  const daily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${schema.usageEvents.occurredAt}), 'YYYY-MM-DD')`,
      calls: sql<number>`count(*)::int`,
      errors: sql<number>`count(*) filter (where ${schema.usageEvents.status} >= 400)::int`,
    })
    .from(schema.usageEvents)
    .where(window)
    .groupBy(sql`date_trunc('day', ${schema.usageEvents.occurredAt})`)
    .orderBy(sql`date_trunc('day', ${schema.usageEvents.occurredAt})`)

  const gate = await gateFor(tenantId)
  const limit = gate.limitFor("monthlyApiCalls")
  const monthStart = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
  const [used] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.tenantId, tenantId),
        gte(schema.usageEvents.occurredAt, monthStart),
        eq(schema.usageEvents.billable, true),
      ),
    )

  const total = totals?.calls ?? 0
  const errors = totals?.errors ?? 0
  return {
    period: { from, to },
    total,
    errors,
    errorRate: total > 0 ? errors / total : 0,
    p95LatencyMs: totals?.p95 ?? null,
    byProduct,
    byApp,
    daily,
    allowance: { used: used?.n ?? 0, limit },
  }
}
