import { getContext } from "@/lib/context"
import { createInspectionHandler } from "@/lib/deploy/migration/http"

export const runtime = "nodejs"
export const POST = createInspectionHandler(getContext)
