import { test } from "node:test"
import assert from "node:assert/strict"
import { mayWrite, effectiveSnapshot, planKeyFor } from "../../src/lib/plans/plan-billing-core"
import { DEVELOPER_CATALOG as C, lookupKeyFor, canManageBilling } from "../../src/lib/plans/billing-catalog"

const now = Date.parse("2026-10-08")
const future = new Date("2026-12-01")

test("API plans are sold only as Build or Scale by stable lookup key", () => {
  assert.equal(lookupKeyFor("build", "monthly"), "developer_build_monthly")
  assert.equal(lookupKeyFor("scale", "annual"), "developer_scale_annual")
  assert.equal(lookupKeyFor("free", "monthly"), null)
  assert.equal(lookupKeyFor("collector", "monthly"), null)
  assert.equal(planKeyFor(C, { id: "s", status: "active", lookup_key: "developer_scale_monthly" }), "scale")
  assert.equal(planKeyFor(C, { id: "s", status: "active", lookup_key: "vitrine_collector_monthly" }), null)
})

test("an API plan never replaces another product's live plan in the shared row", () => {
  assert.equal(mayWrite({ planKey: "collector", status: "active", currentPeriodEnd: future }, C, now), false)
  assert.equal(mayWrite({ planKey: "build", status: "past_due", currentPeriodEnd: future }, C, now), true)
  assert.equal(mayWrite({ planKey: "free", status: "active", currentPeriodEnd: null }, C, now), true)
})

test("an ended subscription defers to another live one for the same workspace", () => {
  const ended = { id: "sub_1", status: "canceled", lookup_key: "developer_build_monthly" }
  const live = { id: "sub_2", status: "trialing", lookup_key: "developer_scale_monthly" }
  assert.equal(effectiveSnapshot(ended, [live, ended]).id, "sub_2")
})

test("only owners and admins handle billing", () => {
  assert.deepEqual(["owner", "admin", "manager", "member", "viewer"].map(canManageBilling), [true, true, false, false, false])
})
