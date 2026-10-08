import { NextResponse } from "next/server"
import { requireContext } from "@/lib/context"
import { createPortalSession, listSubscriptions } from "@/lib/axxes-payments"
import { canManageBilling } from "@/lib/plans/billing-catalog"
import { publicOrigin } from "@/lib/public-origin"

export const dynamic = "force-dynamic"

/** Opens the AXXES Payments billing portal (update card, cancel) for the active workspace's API plan. */
export async function POST(request: Request) {
  const ctx = await requireContext()
  if (!canManageBilling(ctx.role)) {
    return NextResponse.json({ message: "Only workspace owners and admins can manage billing." }, { status: 403 })
  }
  try {
    const [latest] = await listSubscriptions(ctx.tenant.id)
    if (!latest) return NextResponse.json({ message: "This workspace has no API plan subscription." }, { status: 404 })
    const portal = await createPortalSession(latest.id, `${publicOrigin(request)}/dashboard/developer/plans`)
    return NextResponse.json({ url: portal.url })
  } catch {
    return NextResponse.json({ message: "Subscription management is unavailable." }, { status: 502 })
  }
}
