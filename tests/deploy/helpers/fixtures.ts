import { readFile } from "node:fs/promises"
import type { Pool } from "pg"
export const tenantA = "11111111-1111-4111-8111-111111111111"
export const tenantB = "22222222-2222-4222-8222-222222222222"
export const projectA = "33333333-3333-4333-8333-333333333333"
export const projectB = "44444444-4444-4444-8444-444444444444"
export const projectA2 = "55555555-5555-4555-8555-555555555555"
export const grantA = "66666666-6666-4666-8666-666666666666"
export const rateA = "77777777-7777-4777-8777-777777777777"
export const subjectA = { tenantId: tenantA, projectId: projectA }
export async function applyFoundation(pool: Pool) {
  await pool.query("CREATE TABLE tenants (id uuid PRIMARY KEY)")
  await pool.query("INSERT INTO tenants VALUES ($1),($2)", [tenantA, tenantB])
  const sql = await readFile("db/deploy/001-foundation.sql", "utf8")
  const client = await pool.connect()
  try {
    await client.query(sql)
    await client.query(sql)
  } finally {
    client.release()
  }
  await pool.query(
    "INSERT INTO deploy_projects(id,tenant_id,name) VALUES($1,$2,$3),($4,$5,$6),($7,$2,$8)",
    [
      projectA,
      tenantA,
      "Jose project",
      projectB,
      tenantB,
      "Customer project",
      projectA2,
      "Another project",
    ],
  )
}
export async function grant(
  pool: Pool,
  beneficiary = "jose",
  projectId: string | null = projectA,
) {
  await pool.query(
    `INSERT INTO deploy_exemption_grants(id,tenant_id,project_id,beneficiary,starts_at,issued_by,reason) VALUES($1,$2,$3,$4,'2026-10-01','verified-admin','Owner approved exemption')`,
    [grantA, tenantA, projectId, beneficiary],
  )
}
export async function rate(
  pool: Pool,
  numerator = "1000000",
  denominator = "1",
) {
  await pool.query(
    `INSERT INTO deploy_rate_versions(id,region,runtime_class,unit,numerator,denominator,effective_at) VALUES($1,'us-west1','static','request',$2,$3,'2026-10-01')`,
    [rateA, numerator, denominator],
  )
}
