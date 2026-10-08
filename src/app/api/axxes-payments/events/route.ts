import { NextResponse } from "next/server"
import { paymentsMode, verifyPaymentsEvent } from "@/lib/axxes-payments"
import { applyPlanSnapshot } from "@/lib/plans/billing"
import { DEVELOPER_CATALOG } from "@/lib/plans/billing-catalog"

export const dynamic = "force-dynamic"

// Signed subscription events from payments.axxes.app. A non-2xx answer makes Payments retry.
export async function POST(request: Request) {
  const body = await request.text()
  if (body.length > 65536) return NextResponse.json({ error: "Too large" }, { status: 413 })
  const event = verifyPaymentsEvent(body, request.headers.get("axxes-payments-signature"))
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  if (event.product !== "developer" || event.mode !== paymentsMode()) return NextResponse.json({ ignored: true })
  if (event.subscription) await applyPlanSnapshot(event.subscription, DEVELOPER_CATALOG)
  return NextResponse.json({ received: true })
}
