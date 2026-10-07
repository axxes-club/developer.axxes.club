import { test } from "node:test"
import assert from "node:assert/strict"
import { withDeployDatabase } from "./helpers/postgres"
import {
  applyFoundation,
  subjectA,
  tenantA,
  tenantB,
  projectB,
  grantA,
  rateA,
  grant,
  rate,
} from "./helpers/fixtures"
import {
  appendUsage,
  summarizeHostingUsage,
  adjustUsage,
} from "../../src/lib/deploy/ledger"
const event = {
  subject: subjectA,
  provider: "gcp",
  source: "requests",
  sourceId: "first",
  occurredAt: new Date("2026-10-02"),
  quantity: 3n,
  unit: "request" as const,
  rateVersionId: rateA,
}

test("ledger deduplicates concurrent events and conflicts on changed payload or tenant", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await rate(pool)
    const results = await Promise.all(
      Array.from({ length: 8 }, () => appendUsage(event, pool)),
    )
    assert.equal(new Set(results.map((r) => r.id)).size, 1)
    assert.equal(results.filter((r) => !r.duplicate).length, 1)
    await assert.rejects(
      appendUsage({ ...event, quantity: 4n }, pool),
      /conflict/i,
    )
    await assert.rejects(
      appendUsage(
        { ...event, subject: { tenantId: tenantB, projectId: projectB } },
        pool,
      ),
      /conflict/i,
    )
    assert.equal(
      (
        await summarizeHostingUsage(
          subjectA,
          new Date("2026-10-01"),
          new Date("2026-11-01"),
          pool,
        )
      ).chargedMicroUsd,
      3000000n,
    )
    await assert.rejects(
      pool.query("DELETE FROM deploy_usage_entries"),
      /append-only/,
    )
  }))
test("exemption and immutable price snapshots preserve historical zero charges after revocation", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await rate(pool)
    await grant(pool)
    const first = await appendUsage(event, pool)
    await pool.query(
      `INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,'2026-10-03','admin','fixture')`,
      [grantA, tenantA],
    )
    await appendUsage(
      { ...event, sourceId: "later", occurredAt: new Date("2026-10-04") },
      pool,
    )
    assert.equal((await appendUsage(event, pool)).id, first.id)
    const summary = await summarizeHostingUsage(
      subjectA,
      new Date("2026-10-01"),
      new Date("2026-11-01"),
      pool,
    )
    assert.equal(summary.chargedMicroUsd, 3000000n)
    assert.equal(summary.exemptMicroUsd, 3000000n)
    await assert.rejects(
      pool.query("UPDATE deploy_rate_versions SET numerator=1 WHERE id=$1", [
        rateA,
      ]),
      /append-only/,
    )
    await assert.rejects(
      summarizeHostingUsage(
        { tenantId: tenantB, projectId: subjectA.projectId },
        new Date("2026-10-01"),
        new Date("2026-11-01"),
        pool,
      ),
      /not found/,
    )
  }))
test("quantities remain exact, invalid units/time reject, line rounding follows aggregation", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await rate(pool, "1", "3")
    for (let i = 0; i < 3; i++)
      await appendUsage({ ...event, sourceId: `tiny-${i}`, quantity: 1n }, pool)
    assert.equal(
      (
        await summarizeHostingUsage(
          subjectA,
          new Date("2026-10-01"),
          new Date("2026-11-01"),
          pool,
        )
      ).chargedMicroUsd,
      1n,
    )
    await appendUsage(
      { ...event, sourceId: "large", quantity: 9007199254740993n },
      pool,
    )
    await assert.rejects(appendUsage({ ...event, quantity: -1n }, pool))
    await assert.rejects(
      appendUsage({ ...event, occurredAt: new Date(NaN) }, pool),
    )
    await assert.rejects(
      appendUsage({ ...event, occurredAt: new Date("2026-09-01") }, pool),
      /rate/i,
    )
    await assert.rejects(
      appendUsage({ ...event, unit: "build_ms" }, pool),
      /rate/i,
    )
    assert.equal(
      (
        await pool.query(
          "SELECT quantity::text FROM deploy_usage_entries WHERE source_id='large'",
        )
      ).rows[0].quantity,
      "9007199254740993",
    )
  }))
test("audited additive refunds are capped and deduplicated without rewriting consumption", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await rate(pool)
    const entry = await appendUsage(event, pool)
    const adjustment = {
      subject: subjectA,
      usageEntryId: entry.id,
      sourceId: "credit-1",
      amountMicroUsd: -1000000n,
      issuedBy: "billing-admin",
      reason: "AXXES-caused failure",
      occurredAt: new Date("2026-10-06"),
    }
    await adjustUsage(adjustment, pool)
    await adjustUsage(adjustment, pool)
    assert.equal(
      (
        await summarizeHostingUsage(
          subjectA,
          new Date("2026-10-01"),
          new Date("2026-11-01"),
          pool,
        )
      ).chargedMicroUsd,
      2000000n,
    )
    await assert.rejects(
      adjustUsage(
        { ...adjustment, sourceId: "too-large", amountMicroUsd: -3000000n },
        pool,
      ),
      /exceeds/i,
    )
    await assert.rejects(
      adjustUsage({ ...adjustment, amountMicroUsd: -2n }, pool),
      /conflict/i,
    )
    await assert.rejects(
      pool.query("UPDATE deploy_billing_adjustments SET amount_micro_usd=0"),
      /append-only/,
    )
  }))
