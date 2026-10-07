import { publicOrigin } from "../../public-origin"
import { HostingAccessError, requireHostingAccess } from "../authorization"
import { MAX_MANIFEST_BYTES, parseMigrationManifest } from "./manifest"
import { inspectMigration } from "./inspect"
export type InspectionContext = { tenant: { id: string }; role: string }
class BodyTooLarge extends Error {}
const response = (data: unknown, status: number) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } })
async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length")
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || BigInt(declared) > BigInt(MAX_MANIFEST_BYTES))
  )
    throw new BodyTooLarge()
  if (!request.body) throw new Error("Missing body")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > MAX_MANIFEST_BYTES) {
        await reader.cancel()
        throw new BodyTooLarge()
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
}
/** The route supplies the real active-membership resolver; tests exercise this handler boundary. */
export function createInspectionHandler(
  resolveContext: () => Promise<InspectionContext | null>,
) {
  return async function (request: Request): Promise<Response> {
    let ctx: InspectionContext | null
    try {
      ctx = await resolveContext()
    } catch {
      return response({ error: "Inspection is temporarily unavailable" }, 503)
    }
    if (!ctx) return response({ error: "Sign in to inspect a project" }, 401)
    try {
      requireHostingAccess(ctx, "inspect")
    } catch (error) {
      if (error instanceof HostingAccessError)
        return response({ error: "Inspection access denied" }, 403)
      throw error
    }
    if (request.headers.get("origin") !== publicOrigin(request))
      return response({ error: "Same-origin request required" }, 403)
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      return response({ error: "JSON content type required" }, 415)
    try {
      const input = await readBoundedJson(request)
      if (!input || typeof input !== "object" || Array.isArray(input))
        return response({ error: "Invalid inspection request" }, 400)
      const value = input as Record<string, unknown>
      if (
        Object.keys(value).some(
          (key) => !["tenantId", "manifest"].includes(key),
        )
      )
        return response({ error: "Invalid inspection request" }, 400)
      if (typeof value.tenantId !== "string")
        return response({ error: "Invalid inspection request" }, 400)
      if (value.tenantId !== ctx.tenant.id)
        return response({ error: "Organization access denied" }, 403)
      return response(
        inspectMigration(parseMigrationManifest(value.manifest)),
        200,
      )
    } catch (error) {
      return response(
        {
          error:
            error instanceof BodyTooLarge
              ? "Inspection request is too large"
              : "Invalid migration manifest",
        },
        error instanceof BodyTooLarge ? 413 : 400,
      )
    }
  }
}
