import { test } from "node:test"
import assert from "node:assert/strict"
import { createInspectionHandler } from "../../src/lib/deploy/migration/http"
const origin = "https://developer.axxes.club"
const manifest = {
  packageJson: {
    dependencies: { next: "16.3.6" },
    scripts: { build: "next build" },
  },
  rootDirectory: ".",
  lockfileKind: "npm",
}
const request = (body: unknown, extra: Record<string, string> = {}) =>
  new Request(`${origin}/api/deploy/inspect`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...extra },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
const ctx = { tenant: { id: "a" }, role: "owner" }

test("inspection requires signed-in owner/admin in the requested active tenant", async () => {
  assert.equal(
    (
      await createInspectionHandler(async () => null)(
        request({ tenantId: "a", manifest }),
      )
    ).status,
    401,
  )
  for (const role of ["manager", "member", "viewer"])
    assert.equal(
      (
        await createInspectionHandler(async () => ({ ...ctx, role }))(
          request({ tenantId: "a", manifest }),
        )
      ).status,
      403,
    )
  assert.equal(
    (
      await createInspectionHandler(async () => ctx)(
        request({ tenantId: "b", manifest }),
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await createInspectionHandler(async () => ctx)(
        request(
          { tenantId: "a", manifest },
          { origin: "https://evil.example" },
        ),
      )
    ).status,
    403,
  )
})
test("authenticated inspection rejects malformed JSON, content type and secrets without echo", async () => {
  const handler = createInspectionHandler(async () => ctx)
  assert.equal((await handler(request("{"))).status, 400)
  assert.equal(
    (
      await handler(
        request({ tenantId: "a", manifest }, { "content-type": "text/plain" }),
      )
    ).status,
    415,
  )
  const response = await handler(
    request({
      tenantId: "a",
      manifest: { ...manifest, env: { TOKEN: "secret-value" } },
    }),
  )
  assert.equal(response.status, 400)
  assert.equal((await response.text()).includes("secret-value"), false)
  const success = await handler(request({ tenantId: "a", manifest }))
  assert.equal(success.status, 200)
  assert.equal((await success.json()).candidateRuntime, "nextjs")
  assert.equal(success.headers.get("cache-control"), "no-store")
})
test("stream byte limit is enforced despite missing or lying Content-Length", async () => {
  const handler = createInspectionHandler(async () => ctx)
  const headerCases: Record<string, string>[] = [{}, { "content-length": "1" }]
  for (const headers of headerCases) {
    const response = await handler(request("x".repeat(256 * 1024 + 1), headers))
    assert.equal(response.status, 413)
  }
  assert.equal(
    (
      await handler(
        request({ tenantId: "a", manifest }, { "content-length": "9999999" }),
      )
    ).status,
    413,
  )
})
test("missing Origin fails closed and Cloud Run internal URL uses preserved public Host", async () => {
  const handler = createInspectionHandler(async () => ctx)
  const input = request({ tenantId: "a", manifest })
  input.headers.delete("origin")
  assert.equal((await handler(input)).status, 403)
  const proxy = new Request("http://0.0.0.0:8080/api/deploy/inspect", {
    method: "POST",
    headers: {
      origin,
      host: "developer.axxes.club",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
    },
    body: JSON.stringify({ tenantId: "a", manifest }),
  })
  assert.equal((await handler(proxy)).status, 200)
})
