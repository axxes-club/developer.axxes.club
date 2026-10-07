import { test } from "node:test"
import assert from "node:assert/strict"
import type { Pool } from "pg"
import { withDeployDatabase } from "./helpers/postgres"
import {
  applyFoundation,
  subjectA,
  tenantA,
  grantA,
  rateA,
  grant,
  rate,
} from "./helpers/fixtures"
import {
  appendUsage,
  adjustUsage,
  summarizeHostingUsage,
} from "../../src/lib/deploy/ledger"
import { reserveBudget, settleReservation } from "../../src/lib/deploy/budget"
const event = {
  subject: subjectA,
  provider: "gcp",
  source: "requests",
  sourceId: "snapshot-initial",
  occurredAt: new Date("2026-10-02"),
  quantity: 3n,
  unit: "request" as const,
  rateVersionId: rateA,
}

test("usage summary uses one snapshot when another transaction adds usage and its credit", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await rate(pool)
    await appendUsage(event, pool)
    let inserted = false
    // Scheduling barrier over the real PG client, not a fabricated database response.
    const synchronized = new Proxy(pool, {
      get(target, property) {
        if (property === "connect")
          return async () => {
            const client = await target.connect()
            return new Proxy(client, {
              get(connection, field) {
                if (field === "query")
                  return async (sql: string, values?: unknown[]) => {
                    const result = await connection.query(sql, values)
                    if (!inserted && sql.startsWith("SELECT unit,quantity")) {
                      inserted = true
                      const entry = await appendUsage(
                        { ...event, sourceId: "snapshot-new" },
                        pool,
                      )
                      await adjustUsage(
                        {
                          subject: subjectA,
                          usageEntryId: entry.id,
                          sourceId: "snapshot-credit",
                          amountMicroUsd: -3000000n,
                          issuedBy: "billing-admin",
                          reason: "Fixture credit",
                          occurredAt: new Date("2026-10-06"),
                        },
                        pool,
                      )
                    }
                    return result
                  }
                const value = Reflect.get(connection, field)
                return typeof value === "function"
                  ? value.bind(connection)
                  : value
              },
            })
          }
        const value = Reflect.get(target, property)
        return typeof value === "function" ? value.bind(target) : value
      },
    }) as Pool
    const summary = await summarizeHostingUsage(
      subjectA,
      new Date("2026-10-01"),
      new Date("2026-11-01"),
      synchronized,
    )
    assert.equal(inserted, true)
    assert.equal(summary.entries, 1)
    assert.equal(summary.chargedMicroUsd, 3000000n)
    assert.equal(summary.adjustmentMicroUsd, 0n)
  }))

test("database rejects backdated revocation and delayed historical usage stays exempt", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await rate(pool)
    await grant(pool)
    await assert.rejects(
      pool.query(
        `INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,'2026-10-03','admin','Attempted backdate')`,
        [grantA, tenantA],
      ),
      /prospective/i,
    )
    const revoked = await pool.query(
      `INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,now(),'admin','Prospective revocation') RETURNING ends_at`,
      [grantA, tenantA],
    )
    await appendUsage(event, pool)
    const historical = await summarizeHostingUsage(
      subjectA,
      new Date("2026-10-01"),
      new Date("2026-11-01"),
      pool,
    )
    assert.equal(historical.chargedMicroUsd, 0n)
    assert.equal(historical.exemptMicroUsd, 3000000n)
    await appendUsage(
      {
        ...event,
        sourceId: "post-revocation",
        occurredAt: new Date(revoked.rows[0].ends_at.getTime() + 1),
      },
      pool,
    )
    assert.equal(
      (
        await summarizeHostingUsage(
          subjectA,
          new Date("2026-10-01"),
          new Date(revoked.rows[0].ends_at.getTime() + 60000),
          pool,
        )
      ).chargedMicroUsd,
      3000000n,
    )
  }))

test("over-reservation settlement commits one scoped reconciliation incident across retries", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await pool.query(
      "INSERT INTO deploy_billing_accounts(tenant_id,available_micro_usd) VALUES($1,10000000)",
      [tenantA],
    )
    const reserved = await reserveBudget(
      { subject: subjectA, operationId: "overrun", amountMicroUsd: 2000000n },
      pool,
    )
    for (let i = 0; i < 2; i++)
      await assert.rejects(
        settleReservation(
          {
            subject: subjectA,
            reservationId: reserved.reservationId!,
            actualMicroUsd: 3000000n,
          },
          pool,
        ),
        /exceeds/i,
      )
    const result = await pool.query(
      "SELECT tenant_id,project_id,actual_micro_usd::text AS actual FROM deploy_budget_incidents WHERE reservation_id=$1",
      [reserved.reservationId],
    )
    assert.equal(result.rowCount, 1)
    assert.equal(result.rows[0].tenant_id, tenantA)
    assert.equal(result.rows[0].project_id, subjectA.projectId)
    assert.equal(result.rows[0].actual, "3000000")
    assert.equal(
      (
        await pool.query(
          "SELECT available_micro_usd::text AS balance FROM deploy_billing_accounts WHERE tenant_id=$1",
          [tenantA],
        )
      ).rows[0].balance,
      "8000000",
    )
    assert.equal(
      (
        await pool.query(
          "SELECT state FROM deploy_budget_reservations WHERE id=$1",
          [reserved.reservationId],
        )
      ).rows[0].state,
      "reserved",
    )
    await assert.rejects(
      pool.query("DELETE FROM deploy_budget_incidents"),
      /append-only/,
    )
  }))

test("free operations report overruns without enforcing a billing budget", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await grant(pool)
    const reserved = await reserveBudget(
      {
        subject: subjectA,
        operationId: "exempt-overrun",
        amountMicroUsd: 2000000n,
      },
      pool,
      new Date("2026-10-02"),
    )
    await settleReservation(
      {
        subject: subjectA,
        reservationId: reserved.reservationId!,
        actualMicroUsd: 3000000n,
      },
      pool,
    )
    const row = (
      await pool.query(
        "SELECT state,actual_micro_usd::text AS actual,charged_micro_usd::text AS charge FROM deploy_budget_reservations WHERE id=$1",
        [reserved.reservationId],
      )
    ).rows[0]
    assert.deepEqual(row, { state: "settled", actual: "3000000", charge: "0" })
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM deploy_budget_incidents WHERE reservation_id=$1",
          [reserved.reservationId],
        )
      ).rows[0].n,
      1,
    )
  }))

test("sub-millisecond revocation timestamps never charge events before the requested cutoff", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await grant(pool)
    const planned = (
      await pool.query(`SELECT (date_trunc('second', now()+interval '1 day')+interval '123456 microseconds') AS at,
    (date_trunc('second', now()+interval '1 day')+interval '123456 microseconds')::text AS encoded`)
    ).rows[0]
    await pool.query(
      `INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,$3,'admin','Scheduled fixture revocation')`,
      [grantA, tenantA, planned.encoded],
    )
    const { loadHostingPolicy } =
      await import("../../src/lib/deploy/exemptions")
    assert.equal(
      (await loadHostingPolicy(subjectA, planned.at, pool)).exempt,
      true,
    )
    assert.equal(
      (
        await loadHostingPolicy(
          subjectA,
          new Date(planned.at.getTime() + 1),
          pool,
        )
      ).exempt,
      false,
    )
  }))
