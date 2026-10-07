import { nonnegative } from "./pricing"
export type MarginScenario = {
  feeMicroUsd: bigint
  includedCreditMicroUsd: bigint
  retailUsageMicroUsd: bigint
  resourceCostMicroUsd: bigint
  overheadMicroUsd: bigint
  budgetBufferMicroUsd: bigint
  paymentFeeBps: number
  paymentFixedMicroUsd: bigint
  targetMarginBps?: number
}
function bps(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= 10000)
    throw new Error("Invalid basis points")
}
const ceilDivide = (n: bigint, d: bigint) => (n + d - 1n) / d
export function requiredRevenue(
  costMicroUsd: bigint,
  targetMarginBps: number,
  paymentFeeBps = 0,
  paymentFixedMicroUsd = 0n,
): bigint {
  nonnegative(costMicroUsd)
  nonnegative(paymentFixedMicroUsd)
  bps(targetMarginBps)
  bps(paymentFeeBps)
  const capacity = 10000 - targetMarginBps - paymentFeeBps
  if (capacity <= 0)
    throw new Error("Margin and fees leave no revenue capacity")
  let revenue = ceilDivide(
    (costMicroUsd + paymentFixedMicroUsd) * 10000n,
    BigInt(capacity),
  )
  // Payment fees round up to a micro-unit; meet the margin floor after that rounding too.
  while (
    (costMicroUsd +
      paymentFixedMicroUsd +
      ceilDivide(revenue * BigInt(paymentFeeBps), 10000n)) *
      10000n >
    revenue * BigInt(10000 - targetMarginBps)
  )
    revenue++
  return revenue
}
export function assessMargin(input: MarginScenario): {
  passed: boolean
  grossMarginBps: number
  revenueMicroUsd: bigint
  costMicroUsd: bigint
  deficitMicroUsd: bigint
} {
  const {
    feeMicroUsd: fee,
    includedCreditMicroUsd: credit,
    retailUsageMicroUsd: usage,
    resourceCostMicroUsd: resources,
    overheadMicroUsd: overhead,
    budgetBufferMicroUsd: buffer,
    paymentFixedMicroUsd: fixed,
  } = input
  for (const value of [fee, credit, usage, resources, overhead, buffer, fixed])
    nonnegative(value)
  const margin = input.targetMarginBps ?? 4000
  bps(margin)
  bps(input.paymentFeeBps)
  const revenue = fee + (usage > credit ? usage - credit : 0n)
  const baseCost = resources + overhead + buffer
  const cost =
    baseCost + fixed + ceilDivide(revenue * BigInt(input.paymentFeeBps), 10000n)
  const required = requiredRevenue(baseCost, margin, input.paymentFeeBps, fixed)
  return {
    passed: revenue > 0n && cost * 10000n <= revenue * BigInt(10000 - margin),
    grossMarginBps:
      revenue > 0n ? Number(((revenue - cost) * 10000n) / revenue) : 0,
    revenueMicroUsd: revenue,
    costMicroUsd: cost,
    deficitMicroUsd: required > revenue ? required - revenue : 0n,
  }
}
