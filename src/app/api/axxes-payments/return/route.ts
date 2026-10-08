import { NextResponse, type NextRequest } from "next/server"
import { getCheckout, getSubscription } from "@/lib/axxes-payments"
import { applyPlanSnapshot } from "@/lib/plans/billing"
import { DEVELOPER_CATALOG } from "@/lib/plans/billing-catalog"
import { publicOrigin } from "@/lib/public-origin"

export const dynamic = "force-dynamic"

// Buyers return here from payments.axxes.app. The checkout ID is a pointer only; the plan that
// gateFor() reads is written from state read back from Payments with this product's key.
export async function GET(request: NextRequest) {
  const plans = new URL("/dashboard/developer/plans", publicOrigin(request))
  try {
    const checkout = await getCheckout(request.nextUrl.searchParams.get("axxes_checkout") ?? "")
    const done = checkout.state === "paid" || checkout.state === "no_payment_due"
    if (checkout.product === "developer" && checkout.subscription && done) {
      await applyPlanSnapshot(await getSubscription(checkout.subscription), DEVELOPER_CATALOG)
      plans.searchParams.set("subscription", "success")
    } else {
      plans.searchParams.set("subscription", "incomplete")
    }
  } catch {
    plans.searchParams.set("subscription", "incomplete")
  }
  return NextResponse.redirect(plans, 303)
}
