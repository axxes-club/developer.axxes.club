import { NextResponse } from "next/server"
import { requireContext } from "@/lib/context"
import { createCheckout, PaymentsError } from "@/lib/axxes-payments"
import { canSellTo } from "@/lib/plans/billing"
import { DEVELOPER_CATALOG, canManageBilling, lookupKeyFor } from "@/lib/plans/billing-catalog"
import { publicOrigin } from "@/lib/public-origin"

export const dynamic = "force-dynamic"

/** An owner or admin starts a Build or Scale API plan for the active workspace on AXXES Payments. */
export async function POST(request: Request) {
  const ctx = await requireContext()
  if (!canManageBilling(ctx.role)) {
    return NextResponse.json({ message: "Only workspace owners and admins can change the plan." }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const lookupKey = lookupKeyFor(String(body.plan ?? ""), String(body.interval ?? "monthly"))
  if (!lookupKey) return NextResponse.json({ message: "Unknown plan." }, { status: 400 })

  const sellable = await canSellTo(ctx.tenant.id, DEVELOPER_CATALOG)
  if (!sellable.ok) {
    return NextResponse.json({ message: `${ctx.tenant.name} already has an AXXES plan (${sellable.current}). Contact AXXES to add an API plan.` }, { status: 409 })
  }
  if (sellable.current) {
    return NextResponse.json({ message: "This workspace already has an API plan. Use Manage subscription to change or cancel it." }, { status: 409 })
  }
  try {
    const checkout = await createCheckout({
      product: "developer",
      purchase: "subscription",
      lookupKey,
      reference: ctx.tenant.id,
      idempotencyKey: `developer-${ctx.tenant.id}-${lookupKey}-${Date.now()}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100),
      returnUrl: `${publicOrigin(request)}/api/axxes-payments/return`,
      email: ctx.user.email || undefined,
    })
    return NextResponse.json({ url: checkout.checkout_url })
  } catch (error) {
    console.error("developer_checkout_failed", error instanceof PaymentsError ? error.status : "unknown")
    return NextResponse.json({ message: "Checkout is unavailable right now." }, { status: 502 })
  }
}
