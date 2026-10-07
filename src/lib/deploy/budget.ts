import {assertFreeDeploymentOwner} from "./free-owner"
import type { Pool, PoolClient } from "pg"
import { hostingPool, inHostingTransaction } from "./postgres"
import { loadHostingPolicy } from "./exemptions"
import { validateMoney } from "./ledger"
import type { HostingSubject } from "./types"
export type ReservationResult = {
  reservationId: string | null
  status: "reserved" | "exempt" | "insufficient"
}
/** Amounts reserve customer-facing retail charges, not raw provider expenses. */
export async function reserveBudget(
  input: {
    subject: HostingSubject
    operationId: string
    amountMicroUsd: bigint
    actorUserId?: string
  },
  pool: Pool = hostingPool(),
  at: Date = new Date(),
): Promise<ReservationResult> {
  validateMoney(input.amountMicroUsd)
  if (!input.operationId || input.operationId.length > 512)
    throw new Error("Invalid operation id")
  return inHostingTransaction(pool,client=>reserveBudgetInTransaction(input,client,at))
}
export type BudgetInput=Parameters<typeof reserveBudget>[0]
/** Shared control-plane admission uses the caller's transaction, never nested BEGIN. */
export async function reserveBudgetInTransaction(input:BudgetInput,client:PoolClient,at:Date=new Date()):Promise<ReservationResult>{
    validateMoney(input.amountMicroUsd)
    if (!input.operationId || input.operationId.length > 512) throw new Error("Invalid operation id")
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      JSON.stringify([
        "budget",
        input.subject.tenantId,
        input.subject.projectId,
        input.operationId,
      ]),
    ])
    const prior = await client.query(
      "SELECT id,amount_micro_usd::text,exemption_grant_id,state FROM deploy_budget_reservations WHERE tenant_id=$1 AND project_id=$2 AND operation_id=$3",
      [input.subject.tenantId, input.subject.projectId, input.operationId],
    )
    if (prior.rowCount) {
      const row = prior.rows[0]
      if(row.exemption_grant_id)await assertFreeDeploymentOwner(input.actorUserId,client)
      if (BigInt(row.amount_micro_usd) !== input.amountMicroUsd)
        throw new Error("Reservation conflict")
      if (row.state !== "reserved")
        throw new Error("Operation already finished")
      return {
        reservationId: row.id,
        status: row.exemption_grant_id ? "exempt" : "reserved",
      }
    }
    const policy = await loadHostingPolicy(input.subject, at, client)
    if(policy.exempt)await assertFreeDeploymentOwner(input.actorUserId,client)
    if (!policy.exempt) {
      const reserved = await client.query(
        "UPDATE deploy_billing_accounts SET available_micro_usd=available_micro_usd-$2,updated_at=now() WHERE tenant_id=$1 AND available_micro_usd>=$2 RETURNING tenant_id",
        [input.subject.tenantId, input.amountMicroUsd.toString()],
      )
      if (!reserved.rowCount)
        return { reservationId: null, status: "insufficient" }
    }
    const result = await client.query(
      "INSERT INTO deploy_budget_reservations(tenant_id,project_id,operation_id,amount_micro_usd,exemption_grant_id) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [
        input.subject.tenantId,
        input.subject.projectId,
        input.operationId,
        input.amountMicroUsd.toString(),
        policy.grantId,
      ],
    )
    return {
      reservationId: result.rows[0].id,
      status: policy.exempt ? "exempt" : "reserved",
    }
}
type ReservationSubject = { subject: HostingSubject; reservationId: string }
async function lockedReservation(
  client: PoolClient,
  input: ReservationSubject,
) {
  const result = await client.query(
    "SELECT *,amount_micro_usd::text AS amount,actual_micro_usd::text AS actual FROM deploy_budget_reservations WHERE tenant_id=$1 AND project_id=$2 AND id=$3 FOR UPDATE",
    [input.subject.tenantId, input.subject.projectId, input.reservationId],
  )
  if (!result.rowCount) throw new Error("Reservation not found")
  return result.rows[0]
}
async function refund(
  client: PoolClient,
  tenantId: string,
  amount: bigint,
): Promise<void> {
  const result = await client.query(
    "UPDATE deploy_billing_accounts SET available_micro_usd=available_micro_usd+$2,updated_at=now() WHERE tenant_id=$1 RETURNING tenant_id",
    [tenantId, amount.toString()],
  )
  if (!result.rowCount) throw new Error("Billing account not found")
}
/** Settle the accepted retail usage amount; provider cost reconciliation is separate. */
export async function settleReservation(
  input: ReservationSubject & { actualMicroUsd: bigint },
  pool: Pool = hostingPool(),
): Promise<void> {
  validateMoney(input.actualMicroUsd)
  const overrun = await inHostingTransaction(pool, async (client) => {
    const row = await lockedReservation(client, input)
    if (row.state === "settled") {
      if (BigInt(row.actual) !== input.actualMicroUsd)
        throw new Error("Settlement conflict")
      return false
    }
    if (row.state === "cancelled")
      throw new Error("Reservation already cancelled")
    const amount = BigInt(row.amount)
    if (input.actualMicroUsd > amount) {
      await client.query(
        `INSERT INTO deploy_budget_incidents(tenant_id,project_id,reservation_id,kind,actual_micro_usd)
         VALUES($1,$2,$3,'reservation_exceeded',$4) ON CONFLICT(tenant_id,project_id,reservation_id,kind) DO NOTHING`,
        [
          input.subject.tenantId,
          input.subject.projectId,
          input.reservationId,
          input.actualMicroUsd.toString(),
        ],
      )
      if (!row.exemption_grant_id) return true
    }
    const charged = row.exemption_grant_id ? 0n : input.actualMicroUsd
    if (!row.exemption_grant_id)
      await refund(client, input.subject.tenantId, amount - charged)
    await client.query(
      "UPDATE deploy_budget_reservations SET state='settled',actual_micro_usd=$2,charged_micro_usd=$3,finished_at=now() WHERE id=$1",
      [
        input.reservationId,
        input.actualMicroUsd.toString(),
        charged.toString(),
      ],
    )
    return false
  })
  // Report after commit: the durable incident must survive the failure response.
  if (overrun)
    throw new Error(
      "Actual cost exceeds reservation; operation requires reconciliation",
    )
}
export async function cancelReservation(
  input: ReservationSubject,
  pool: Pool = hostingPool(),
): Promise<void> {
  await inHostingTransaction(pool, async (client) => {
    const row = await lockedReservation(client, input)
    if (row.state === "cancelled") return
    if (row.state === "settled") throw new Error("Reservation already settled")
    if (!row.exemption_grant_id)
      await refund(client, input.subject.tenantId, BigInt(row.amount))
    await client.query(
      "UPDATE deploy_budget_reservations SET state='cancelled',actual_micro_usd=0,charged_micro_usd=0,finished_at=now() WHERE id=$1",
      [input.reservationId],
    )
  })
}
