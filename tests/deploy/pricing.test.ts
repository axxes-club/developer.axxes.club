import { test } from "node:test"
import assert from "node:assert/strict"
import {
  HOSTING_TIERS,
  priceQuantity,
  sumPrices,
  roundMicroUsd,
} from "../../src/lib/deploy/pricing"
import { assessMargin, requiredRevenue } from "../../src/lib/deploy/cost-model"

test("candidate tiers bound project and collaborator counts and stay unpublished", () => {
  assert.deepEqual(HOSTING_TIERS.launch, {
    key: "launch",
    feeMicroUsd: 15000000n,
    includedCreditMicroUsd: 5000000n,
    maxProjects: 3,
    maxDeployers: 3,
    published: false,
  })
  assert.deepEqual(HOSTING_TIERS.team, {
    key: "team",
    feeMicroUsd: 39000000n,
    includedCreditMicroUsd: 15000000n,
    maxProjects: 15,
    maxDeployers: 10,
    published: false,
  })
})
test("aggregate fractional usage before rounding monetary lines", () => {
  const prices = [
    priceQuantity(1n, { numerator: 1n, denominator: 3n }),
    priceQuantity(1n, { numerator: 1n, denominator: 3n }),
    priceQuantity(1n, { numerator: 1n, denominator: 3n }),
  ]
  assert.equal(roundMicroUsd(sumPrices(prices)), 1n)
  assert.equal(
    roundMicroUsd(priceQuantity(3n, { numerator: 1n, denominator: 2n })),
    2n,
  )
  assert.equal(
    roundMicroUsd(
      priceQuantity(9007199254740993n, { numerator: 2n, denominator: 1n }),
    ),
    18014398509481986n,
  )
  assert.throws(() => priceQuantity(-1n, { numerator: 1n, denominator: 1n }))
  assert.throws(() => priceQuantity(1n, { numerator: 1n, denominator: 0n }))
})
test("margin floor prices $6 fully allocated costs at $10 for 40% gross margin", () => {
  assert.equal(requiredRevenue(6000000n, 4000), 10000000n)
  assert.equal(requiredRevenue(6000000n, 4000, 300, 300000n), 11052632n)
  assert.throws(() => requiredRevenue(1n, 10000))
})
test("credit exhaustion does not hide costs and fees/support/buffer affect profitability", () => {
  const input = {
    feeMicroUsd: 15000000n,
    includedCreditMicroUsd: 5000000n,
    retailUsageMicroUsd: 5000000n,
    resourceCostMicroUsd: 6000000n,
    overheadMicroUsd: 3000000n,
    budgetBufferMicroUsd: 0n,
    paymentFeeBps: 0,
    paymentFixedMicroUsd: 0n,
  }
  assert.deepEqual(assessMargin(input), {
    passed: true,
    grossMarginBps: 4000,
    revenueMicroUsd: 15000000n,
    costMicroUsd: 9000000n,
    deficitMicroUsd: 0n,
  })
  assert.equal(
    assessMargin({
      ...input,
      paymentFeeBps: 300,
      paymentFixedMicroUsd: 300000n,
    }).passed,
    false,
  )
  assert.equal(
    assessMargin({
      ...input,
      retailUsageMicroUsd: 15000000n,
      resourceCostMicroUsd: 10000000n,
    }).revenueMicroUsd,
    25000000n,
  )
  assert.equal(
    assessMargin({
      ...input,
      resourceCostMicroUsd: 12000000n,
      budgetBufferMicroUsd: 1000000n,
    }).passed,
    false,
  )
  assert.throws(() => assessMargin({ ...input, resourceCostMicroUsd: -1n }))
})
