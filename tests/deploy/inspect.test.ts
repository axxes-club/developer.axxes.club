import { test } from "node:test"
import assert from "node:assert/strict"
import { parseMigrationManifest } from "../../src/lib/deploy/migration/manifest"
import { inspectMigration } from "../../src/lib/deploy/migration/inspect"
const next = {
  packageJson: {
    dependencies: { next: "16.3.6" },
    scripts: { build: "next build" },
  },
  lockfileKind: "npm",
  rootDirectory: ".",
}

test("supported framework detection remains a candidate until real runtime checks pass", () => {
  const report = inspectMigration(parseMigrationManifest(next))
  assert.equal(report.candidateRuntime, "nextjs")
  assert.equal(report.readiness, "action_required")
  assert.ok(report.findings.some((f) => f.code === "runtime_verification"))
  const staticReport = inspectMigration(
    parseMigrationManifest({
      ...next,
      packageJson: {
        dependencies: { vite: "7.0.0" },
        scripts: { build: "vite build" },
      },
    }),
  )
  assert.equal(staticReport.candidateRuntime, "static")
  assert.equal(staticReport.readiness, "action_required")
  assert.equal(
    inspectMigration(
      parseMigrationManifest({
        ...next,
        packageJson: { scripts: { build: "something" } },
      }),
    ).candidateRuntime,
    "unsupported",
  )
})
test("lockfile ambiguity, Vercel services and edge/ISR/images cannot silently pass", () => {
  const report = inspectMigration(
    parseMigrationManifest({
      ...next,
      lockfileKind: "multiple",
      packageJson: {
        ...next.packageJson,
        dependencies: {
          next: "16.3.6",
          "@vercel/blob": "latest",
          "@vercel/kv": "latest",
          "@vercel/postgres": "latest",
        },
      },
      capabilities: { edge: true, isr: true, imageOptimization: true },
      vercelConfig: {
        crons: [{ path: "/job", schedule: "* * * * *" }],
        rewrites: [{ source: "/api", destination: "/v1" }],
      },
    }),
  )
  for (const code of [
    "lockfile",
    "vercel_blob",
    "vercel_kv",
    "vercel_postgres",
    "edge",
    "isr",
    "image_optimization",
    "vercel_configuration",
  ])
    assert.ok(
      report.findings.some((f) => f.code === code),
      code,
    )
  assert.equal(report.readiness, "unsupported")
  assert.ok(
    inspectMigration(
      parseMigrationManifest({ ...next, lockfileKind: "none" }),
    ).findings.some((f) => f.code === "lockfile"),
  )
})
test("manifest rejects traversal, unknown/secret fields, prototype-like keys and excessive nesting", () => {
  for (const rootDirectory of [
    "../private",
    "foo/../../bar",
    "/root",
    "a\\b",
    "https://evil",
  ])
    assert.throws(() => parseMigrationManifest({ ...next, rootDirectory }))
  for (const key of ["env", "secretValues", "tenantId", "token"])
    assert.throws(() =>
      parseMigrationManifest({ ...next, [key]: { TOKEN: "must-not-leak" } }),
    )
  assert.throws(() =>
    parseMigrationManifest({
      ...next,
      vercelConfig: { env: { API_KEY: "must-not-leak" } },
    }),
  )
  for (const key of ["__proto__", "constructor", "prototype"])
    assert.throws(() =>
      parseMigrationManifest(
        JSON.parse(
          `{"packageJson":{"dependencies":{"${key}":"malicious"}},"lockfileKind":"npm","rootDirectory":"."}`,
        ),
      ),
    )
  assert.throws(() =>
    parseMigrationManifest({
      ...next,
      packageJson: { description: "x".repeat(300000) },
    }),
  )
  let nested: unknown = {}
  for (let i = 0; i < 40; i++) nested = { child: nested }
  assert.throws(() => parseMigrationManifest({ ...next, vercelConfig: nested }))
})
test("reports never echo scripts, dependency versions, secret strings or arbitrary configuration", () => {
  const report = inspectMigration(
    parseMigrationManifest({
      ...next,
      packageJson: {
        ...next.packageJson,
        scripts: { build: "TOKEN=SECRET123 next build" },
      },
      environmentVariableNames: ["DATABASE_URL"],
    }),
  )
  assert.equal(JSON.stringify(report).includes("SECRET123"), false)
  assert.deepEqual(report.environmentVariableNames, ["DATABASE_URL"])
})
