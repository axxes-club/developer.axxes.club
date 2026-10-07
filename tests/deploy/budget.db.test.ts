import { test } from "node:test"
import assert from "node:assert/strict"
import { withDeployDatabase } from "./helpers/postgres"
import {
  applyFoundation,
  applyOwnerPolicy,
  freeOwnerId,
  subjectA,
  tenantA,
  tenantB,
  projectB,
  grant,
  grantA,
} from "./helpers/fixtures"
import {
  reserveBudget,
  cancelReservation,
  settleReservation,
} from "../../src/lib/deploy/budget"
const balance = async (pool: import("pg").Pool) =>
  BigInt(
    (
      await pool.query(
        "SELECT available_micro_usd::text AS n FROM deploy_billing_accounts WHERE tenant_id=$1",
        [tenantA],
      )
    ).rows[0].n,
  )

test("concurrent reservations preserve available balance; duplicate cancel credits once", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await pool.query(
      "INSERT INTO deploy_billing_accounts(tenant_id,available_micro_usd) VALUES($1,10000000)",
      [tenantA],
    )
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        reserveBudget(
          {
            subject: subjectA,
            operationId: `op-${i}`,
            amountMicroUsd: 2000000n,
          },
          pool,
        ),
      ),
    )
    assert.equal(results.filter((r) => r.status === "reserved").length, 5)
    assert.equal(await balance(pool), 0n)
    const accepted = results.find((r) => r.status === "reserved")!
    await Promise.all([
      cancelReservation(
        { subject: subjectA, reservationId: accepted.reservationId! },
        pool,
      ),
      cancelReservation(
        { subject: subjectA, reservationId: accepted.reservationId! },
        pool,
      ),
    ])
    assert.equal(await balance(pool), 2000000n)
  }))
test("duplicate operations, settlement/cancel races and foreign subjects cannot double spend", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await pool.query(
      "INSERT INTO deploy_billing_accounts(tenant_id,available_micro_usd) VALUES($1,10000000)",
      [tenantA],
    )
    const input = {
      subject: subjectA,
      operationId: "same",
      amountMicroUsd: 2000000n,
    }
    const results = await Promise.all([
      reserveBudget(input, pool),
      reserveBudget(input, pool),
    ])
    assert.equal(results[0].reservationId, results[1].reservationId)
    assert.equal(await balance(pool), 8000000n)
    await assert.rejects(
      reserveBudget({ ...input, amountMicroUsd: 1n }, pool),
      /conflict/i,
    )
    const settlement = {
      subject: subjectA,
      reservationId: results[0].reservationId!,
      actualMicroUsd: 1000000n,
    }
    await assert.rejects(
      settleReservation({ ...settlement, actualMicroUsd: 3000000n }, pool),
      /exceeds/i,
    )
    await assert.rejects(
      cancelReservation(
        {
          subject: { tenantId: tenantB, projectId: projectB },
          reservationId: settlement.reservationId,
        },
        pool,
      ),
      /not found/,
    )
    const raced = await Promise.allSettled([
      settleReservation(settlement, pool),
      cancelReservation(
        { subject: subjectA, reservationId: settlement.reservationId },
        pool,
      ),
    ])
    assert.ok(raced.some((r) => r.status === "fulfilled"))
    const row = (
      await pool.query(
        "SELECT state FROM deploy_budget_reservations WHERE id=$1",
        [settlement.reservationId],
      )
    ).rows[0]
    assert.equal(
      await balance(pool),
      row.state === "settled" ? 9000000n : 10000000n,
    )
    if (row.state === "settled") {
      await settleReservation(settlement, pool)
      assert.equal(await balance(pool), 9000000n)
      await assert.rejects(
        settleReservation({ ...settlement, actualMicroUsd: 0n }, pool),
        /conflict/i,
      )
    }
  }))
test("exempt operations need no balance and remain zero-charge after revocation", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await grant(pool)
    await applyOwnerPolicy(pool)
    const input = {
      actorUserId:freeOwnerId,
      subject: subjectA,
      operationId: "free",
      amountMicroUsd: 2000000n,
    }
    const result = await reserveBudget(input, pool, new Date("2026-10-02"))
    assert.equal(result.status, "exempt")
    const revoked = await pool.query(
      `INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,now(),'admin','fixture') RETURNING ends_at`,
      [grantA, tenantA],
    )
    await settleReservation(
      {
        subject: subjectA,
        reservationId: result.reservationId!,
        actualMicroUsd: 1500000n,
      },
      pool,
    )
    assert.equal(
      (
        await pool.query(
          "SELECT charged_micro_usd::text AS charged FROM deploy_budget_reservations WHERE id=$1",
          [result.reservationId],
        )
      ).rows[0].charged,
      "0",
    )
    assert.equal(
      (
        await reserveBudget(
          { ...input, operationId: "paid" },
          pool,
          new Date(revoked.rows[0].ends_at.getTime() + 1),
        )
      ).status,
      "insufficient",
    )
    await assert.rejects(reserveBudget({ ...input, amountMicroUsd: -1n }, pool))
  }))
