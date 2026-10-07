import { z } from "zod"
export const MAX_MANIFEST_BYTES = 256 * 1024
const strings = z.record(z.string().min(1).max(200), z.string().max(4096))
const packageJson = z
  .object({
    name: z.string().max(200).optional(),
    version: z.string().max(100).optional(),
    private: z.boolean().optional(),
    type: z.enum(["module", "commonjs"]).optional(),
    description: z.string().max(4096).optional(),
    license: z.string().max(200).optional(),
    scripts: strings.optional(),
    dependencies: strings.optional(),
    devDependencies: strings.optional(),
    peerDependencies: strings.optional(),
    optionalDependencies: strings.optional(),
    engines: strings.optional(),
    packageManager: z.string().max(200).optional(),
    workspaces: z
      .union([
        z.array(z.string().max(200)).max(100),
        z.object({ packages: z.array(z.string().max(200)).max(100) }).strict(),
      ])
      .optional(),
  })
  .strict()
const manifestSchema = z
  .object({
    packageJson,
    lockfileKind: z.enum(["npm", "pnpm", "yarn", "bun", "none", "multiple"]),
    rootDirectory: z
      .string()
      .max(240)
      .refine(
        (root) =>
          root === "." ||
          root === "" ||
          (/^[a-zA-Z0-9._/-]+$/.test(root) &&
            !root.startsWith("/") &&
            !root.split("/").includes("..")),
      ),
    environmentVariableNames: z
      .array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/))
      .max(200)
      .default([]),
    capabilities: z
      .object({
        edge: z.boolean().optional(),
        isr: z.boolean().optional(),
        streaming: z.boolean().optional(),
        imageOptimization: z.boolean().optional(),
        nativeAddons: z.boolean().optional(),
      })
      .strict()
      .optional(),
    vercelConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
export type MigrationManifest = z.infer<typeof manifestSchema>
export class ManifestError extends Error {
  constructor() {
    super("Invalid migration manifest")
    this.name = "ManifestError"
  }
}
function validateTree(
  value: unknown,
  depth = 0,
  seen = new Set<object>(),
): void {
  if (depth > 16) throw new ManifestError()
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) throw new ManifestError()
    seen.add(value)
    if (
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
      throw new ManifestError()
    if (Object.keys(value).length > 1000) throw new ManifestError()
    for (const [key, item] of Object.entries(value)) {
      if (
        [
          "__proto__",
          "prototype",
          "constructor",
          "env",
          "secretValues",
          "secrets",
          "token",
        ].includes(key)
      )
        throw new ManifestError()
      validateTree(item, depth + 1, seen)
    }
    seen.delete(value)
  } else if (
    !["string", "number", "boolean", "undefined"].includes(typeof value) &&
    value !== null
  )
    throw new ManifestError()
}
export function parseMigrationManifest(input: unknown): MigrationManifest {
  try {
    validateTree(input)
    if (Buffer.byteLength(JSON.stringify(input), "utf8") > MAX_MANIFEST_BYTES)
      throw new ManifestError()
    const result = manifestSchema.safeParse(input)
    if (!result.success) throw new ManifestError()
    return result.data
  } catch {
    throw new ManifestError()
  }
}
