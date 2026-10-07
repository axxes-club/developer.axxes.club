import type { MigrationManifest } from "./manifest"
export type MigrationFinding = {
  code: string
  status: "action_required" | "unsupported"
  message: string
  resolution: string
}
export type MigrationReport = {
  candidateRuntime: "static" | "nextjs" | "unsupported"
  readiness: "action_required" | "unsupported"
  findings: MigrationFinding[]
  environmentVariableNames: string[]
}
/** Configuration inspection never evaluates scripts or executes repository code. */
export function inspectMigration(manifest: MigrationManifest): MigrationReport {
  const dependencies = {
    ...manifest.packageJson.dependencies,
    ...manifest.packageJson.devDependencies,
    ...manifest.packageJson.optionalDependencies,
    ...manifest.packageJson.peerDependencies,
  }
  const candidateRuntime = dependencies.next
    ? "nextjs"
    : dependencies.vite && manifest.packageJson.scripts?.build
      ? "static"
      : "unsupported"
  const findings: MigrationFinding[] = []
  const add = (
    code: string,
    message: string,
    resolution: string,
    status: MigrationFinding["status"] = "action_required",
  ) => findings.push({ code, status, message, resolution })
  if (candidateRuntime === "unsupported")
    add(
      "framework",
      "This framework is not supported by the first release.",
      "Use a supported Next.js or Vite static project, or retain the current host.",
      "unsupported",
    )
  else
    add(
      "runtime_verification",
      "This is a deployment candidate; runtime compatibility has not been verified.",
      "Build and exercise the application in the isolated Linux preview before cutover.",
    )
  if (!manifest.packageJson.scripts?.build)
    add(
      "build_script",
      "A build script is missing.",
      "Define and verify the build command before import.",
    )
  if (["none", "multiple"].includes(manifest.lockfileKind))
    add(
      "lockfile",
      "A single package-manager lockfile is required.",
      "Commit one matching lockfile and remove ambiguous lockfiles.",
    )
  if (manifest.packageJson.workspaces)
    add(
      "monorepo",
      "Workspace layout requires explicit build-root validation.",
      "Select the application root and verify dependency installation from the repository root.",
    )
  for (const [dependency, code, name] of [
    ["@vercel/blob", "vercel_blob", "Vercel Blob"],
    ["@vercel/kv", "vercel_kv", "Vercel KV"],
    ["@vercel/postgres", "vercel_postgres", "Vercel Postgres"],
  ] as const) {
    if (dependencies[dependency])
      add(
        code,
        `${name} requires an external-service migration decision.`,
        "Retain an independently usable service or migrate its data and credentials before cutover.",
      )
  }
  if (dependencies["@vercel/functions"])
    add(
      "vercel_functions",
      "Vercel-specific function APIs require review.",
      "Replace platform-specific calls and verify the affected routes.",
    )
  if (manifest.capabilities?.edge)
    add(
      "edge",
      "Vercel Edge behavior is not supported by this initial runtime.",
      "Move the affected code to the supported Node.js runtime and test it.",
      "unsupported",
    )
  if (manifest.capabilities?.isr)
    add(
      "isr",
      "ISR and shared cache behavior require compatibility tests.",
      "Verify revalidation, cache persistence and behavior across instances.",
    )
  if (manifest.capabilities?.streaming)
    add(
      "streaming",
      "Streaming requires end-to-end preview verification.",
      "Verify streaming through the delivery proxy and timeouts.",
    )
  if (manifest.capabilities?.imageOptimization)
    add(
      "image_optimization",
      "Image optimization consumes runtime and delivery resources.",
      "Verify image routes and include their measured cost in the estimate.",
    )
  if (manifest.capabilities?.nativeAddons)
    add(
      "native_addons",
      "Native modules require a Linux build.",
      "Verify native packages in the supported Linux build image.",
    )
  if (manifest.vercelConfig && Object.keys(manifest.vercelConfig).length)
    add(
      "vercel_configuration",
      "Vercel configuration requires translation and validation.",
      "Review routing, cron, regions, build overrides and other platform settings before cutover.",
    )
  return {
    candidateRuntime,
    readiness: findings.some((f) => f.status === "unsupported")
      ? "unsupported"
      : "action_required",
    findings,
    environmentVariableNames: [
      ...new Set(manifest.environmentVariableNames),
    ].sort(),
  }
}
