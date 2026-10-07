import { randomUUID } from "node:crypto"
import { Pool } from "pg"

export function validateTestDatabaseUrl(input: string | undefined): string {
  if (!input) throw new Error("DEPLOY_TEST_DATABASE_URL is required")
  const url = new URL(input)
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(url.hostname) ||
    !["/ci", "/deploy_test"].includes(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Only a dedicated local ci/deploy_test PostgreSQL database is allowed",
    )
  }
  return input
}

export async function withDeployDatabase(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  const connectionString = validateTestDatabaseUrl(
    process.env.DEPLOY_TEST_DATABASE_URL,
  )
  const schema = `deploy_test_${randomUUID().replaceAll("-", "")}`
  const admin = new Pool({ connectionString, max: 1 })
  let scoped: Pool | undefined
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    scoped = new Pool({
      connectionString,
      max: 12,
      options: `-c search_path=${schema},public`,
    })
    await run(scoped)
  } finally {
    await scoped?.end()
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await admin.end()
  }
}
