import { createHash } from "node:crypto"
import type { Pool } from "pg"
import { hostingPool, inHostingTransaction } from "./postgres"
import { loadHostingPolicy } from "./exemptions"
import {
  nonnegative,
  priceQuantity,
  roundMicroUsd,
  sumPrices,
  RESOURCE_UNITS,
  type ResourceUnit,
  type RationalPrice,
} from "./pricing"
import type { HostingSubject } from "./types"

export type HostingUsageInput = {
  subject: HostingSubject
  provider: string
  source: string
  sourceId: string
  occurredAt: Date
  quantity: bigint
  unit: ResourceUnit
  rateVersionId: string
}
const hash = (values: readonly unknown[]) =>
  createHash("sha256").update(JSON.stringify(values)).digest("hex")
const pgMax = 9223372036854775807n
export function validateMoney(value: bigint): void {
  nonnegative(value)
  if (value > pgMax) throw new Error("Quantity exceeds storage capacity")
}
function validText(value: string): void {
  if (typeof value !== "string" || value.length < 1 || value.length > 512)
    throw new Error("Invalid ledger identifier")
}
export async function appendUsage(
  input: HostingUsageInput,
  pool: Pool = hostingPool(),
): Promise<{ id: string; duplicate: boolean }> {
  validateMoney(input.quantity)
  for (const value of [input.provider, input.source, input.sourceId])
    validText(value)
  if (
    !RESOURCE_UNITS.includes(input.unit) ||
    !Number.isFinite(input.occurredAt.getTime()) ||
    input.occurredAt.getTime() > Date.now() + 300000
  )
    throw new Error("Invalid usage event")
  const digest = hash([
    input.subject.tenantId,
    input.subject.projectId,
    input.provider,
    input.source,
    input.sourceId,
    input.occurredAt.toISOString(),
    input.quantity.toString(),
    input.unit,
    input.rateVersionId,
  ])
  return inHostingTransaction(pool, async (client) => {
    // Serialize a provider event globally; cross-tenant payloads conflict instead of silently billing twice.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      JSON.stringify([input.provider, input.source, input.sourceId]),
    ])
    const existing = await client.query(
      "SELECT id,payload_hash FROM deploy_usage_entries WHERE provider=$1 AND source=$2 AND source_id=$3",
      [input.provider, input.source, input.sourceId],
    )
    if (existing.rowCount) {
      if (existing.rows[0].payload_hash !== digest)
        throw new Error("Usage event conflict")
      return { id: existing.rows[0].id, duplicate: true }
    }
    const policy = await loadHostingPolicy(
      input.subject,
      input.occurredAt,
      client,
    )
    const { rows } = await client.query(
      `SELECT r.numerator::text,r.denominator::text FROM deploy_rate_versions r
    JOIN deploy_projects p ON p.region=r.region AND p.runtime_class=r.runtime_class
    WHERE r.id=$1 AND r.unit=$2 AND r.effective_at<=$3 AND p.tenant_id=$4 AND p.id=$5`,
      [
        input.rateVersionId,
        input.unit,
        input.occurredAt,
        input.subject.tenantId,
        input.subject.projectId,
      ],
    )
    if (!rows.length)
      throw new Error("Rate is not valid for this project, unit or event time")
    const price = priceQuantity(input.quantity, {
      numerator: BigInt(rows[0].numerator),
      denominator: BigInt(rows[0].denominator),
    })
    const result = await client.query(
      `INSERT INTO deploy_usage_entries(tenant_id,project_id,provider,source,source_id,payload_hash,occurred_at,quantity,unit,rate_version_id,exemption_grant_id,price_numerator,price_denominator)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        input.subject.tenantId,
        input.subject.projectId,
        input.provider,
        input.source,
        input.sourceId,
        digest,
        input.occurredAt,
        input.quantity.toString(),
        input.unit,
        input.rateVersionId,
        policy.grantId,
        price.numerator.toString(),
        price.denominator.toString(),
      ],
    )
    return { id: result.rows[0].id, duplicate: false }
  })
}
export type BillingAdjustmentInput = {
  subject: HostingSubject
  usageEntryId: string
  sourceId: string
  amountMicroUsd: bigint
  issuedBy: string
  reason: string
  occurredAt: Date
}
/** Internal billing-worker API only; the inspection route never exposes financial writes. */
export async function adjustUsage(
  input: BillingAdjustmentInput,
  pool: Pool = hostingPool(),
): Promise<{ id: string; duplicate: boolean }> {
  if (
    typeof input.amountMicroUsd !== "bigint" ||
    input.amountMicroUsd > 0n ||
    input.amountMicroUsd < -pgMax
  )
    throw new Error("Adjustments must be bounded credits")
  for (const value of [input.sourceId, input.issuedBy, input.reason])
    validText(value)
  if (
    !Number.isFinite(input.occurredAt.getTime()) ||
    input.occurredAt.getTime() > Date.now() + 300000
  )
    throw new Error("Invalid adjustment time")
  const digest = hash([
    input.subject.tenantId,
    input.subject.projectId,
    input.usageEntryId,
    input.sourceId,
    input.amountMicroUsd.toString(),
    input.issuedBy,
    input.reason,
    input.occurredAt.toISOString(),
  ])
  return inHostingTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      JSON.stringify([
        "adjustment",
        input.subject.tenantId,
        input.subject.projectId,
        input.sourceId,
      ]),
    ])
    const prior = await client.query(
      "SELECT id,payload_hash FROM deploy_billing_adjustments WHERE tenant_id=$1 AND project_id=$2 AND source_id=$3",
      [input.subject.tenantId, input.subject.projectId, input.sourceId],
    )
    if (prior.rowCount) {
      if (prior.rows[0].payload_hash !== digest)
        throw new Error("Adjustment conflict")
      return { id: prior.rows[0].id, duplicate: true }
    }
    const original = await client.query(
      "SELECT price_numerator::text,price_denominator::text,exemption_grant_id FROM deploy_usage_entries WHERE tenant_id=$1 AND project_id=$2 AND id=$3 FOR UPDATE",
      [input.subject.tenantId, input.subject.projectId, input.usageEntryId],
    )
    if (!original.rowCount) throw new Error("Usage entry not found")
    if (
      input.occurredAt <
      (
        await client.query(
          "SELECT occurred_at FROM deploy_usage_entries WHERE id=$1",
          [input.usageEntryId],
        )
      ).rows[0].occurred_at
    )
      throw new Error("Adjustment precedes usage")
    const row = original.rows[0]
    // Cap at whole accrued micro-units, not per-event rounded-up prices.
    const cap = row.exemption_grant_id
      ? 0n
      : BigInt(row.price_numerator) / BigInt(row.price_denominator)
    const refunded = await client.query(
      "SELECT coalesce(sum(amount_micro_usd),0)::text AS amount FROM deploy_billing_adjustments WHERE usage_entry_id=$1",
      [input.usageEntryId],
    )
    if (-BigInt(refunded.rows[0].amount) - input.amountMicroUsd > cap)
      throw new Error("Credit exceeds accrued charge")
    const result = await client.query(
      `INSERT INTO deploy_billing_adjustments(tenant_id,project_id,usage_entry_id,source_id,amount_micro_usd,payload_hash,issued_by,reason,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        input.subject.tenantId,
        input.subject.projectId,
        input.usageEntryId,
        input.sourceId,
        input.amountMicroUsd.toString(),
        digest,
        input.issuedBy,
        input.reason,
        input.occurredAt,
      ],
    )
    return { id: result.rows[0].id, duplicate: false }
  })
}
export type HostingUsageSummary = {
  chargedMicroUsd: bigint
  exemptMicroUsd: bigint
  adjustmentMicroUsd: bigint
  entries: number
  byUnit: { unit: ResourceUnit; quantity: bigint }[]
}
export async function summarizeHostingUsage(
  subject: HostingSubject,
  from: Date,
  to: Date,
  pool: Pool = hostingPool(),
): Promise<HostingUsageSummary> {
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to
  )
    throw new Error("Invalid usage window")
  return inHostingTransaction(pool, async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    )
    await loadHostingPolicy(subject, to, client)
    const { rows } = await client.query(
      "SELECT unit,quantity::text,price_numerator::text,price_denominator::text,exemption_grant_id FROM deploy_usage_entries WHERE tenant_id=$1 AND project_id=$2 AND occurred_at>=$3 AND occurred_at<$4",
      [subject.tenantId, subject.projectId, from, to],
    )
    const charged: RationalPrice[] = []
    const exempt: RationalPrice[] = []
    const units = new Map<ResourceUnit, bigint>()
    for (const row of rows) {
      ;(row.exemption_grant_id ? exempt : charged).push({
        numerator: BigInt(row.price_numerator),
        denominator: BigInt(row.price_denominator),
      })
      units.set(row.unit, (units.get(row.unit) ?? 0n) + BigInt(row.quantity))
    }
    const adjustment = await client.query(
      "SELECT coalesce(sum(amount_micro_usd),0)::text AS amount FROM deploy_billing_adjustments WHERE tenant_id=$1 AND project_id=$2 AND occurred_at>=$3 AND occurred_at<$4",
      [subject.tenantId, subject.projectId, from, to],
    )
    const adjustmentMicroUsd = BigInt(adjustment.rows[0].amount)
    return {
      chargedMicroUsd: roundMicroUsd(sumPrices(charged)) + adjustmentMicroUsd,
      exemptMicroUsd: roundMicroUsd(sumPrices(exempt)),
      adjustmentMicroUsd,
      entries: rows.length,
      byUnit: [...units].map(([unit, quantity]) => ({ unit, quantity })),
    }
  })
}
