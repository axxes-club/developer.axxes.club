import { test } from "node:test"
import assert from "node:assert/strict"
import { withDeployDatabase } from "./helpers/postgres"
import {
  applyFoundation,
  tenantA,
  tenantB,
  projectA,
  projectB,
  projectA2,
  grantA,
  subjectA,
  grant,
} from "./helpers/fixtures"
import { loadHostingPolicy } from "../../src/lib/deploy/exemptions"

for (const beneficiary of ["jose", "bayamon", "otto"])
  test(`${beneficiary}: audited grant is scoped and revocation preserves history`, async () =>
    withDeployDatabase(async (pool) => {
      await applyFoundation(pool)
      await grant(pool, beneficiary)
      assert.equal(
        (await loadHostingPolicy(subjectA, new Date("2026-10-10"), pool))
          .exempt,
        true,
      )
      assert.equal(
        (
          await loadHostingPolicy(
            { tenantId: tenantB, projectId: projectB },
            new Date("2026-10-10"),
            pool,
          )
        ).exempt,
        false,
      )
      assert.equal(
        (
          await loadHostingPolicy(
            { tenantId: tenantA, projectId: projectA2 },
            new Date("2026-10-10"),
            pool,
          )
        ).exempt,
        false,
      )
      const revoked = await pool.query(
        `INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,now(),'verified-admin','prospective revocation') RETURNING ends_at`,
        [grantA, tenantA],
      )
      assert.equal(
        (
          await loadHostingPolicy(
            subjectA,
            new Date(revoked.rows[0].ends_at.getTime() - 1),
            pool,
          )
        ).exempt,
        true,
      )
      assert.equal(
        (await loadHostingPolicy(subjectA, revoked.rows[0].ends_at, pool))
          .exempt,
        false,
      )
      await assert.rejects(
        pool.query(
          "UPDATE deploy_exemption_grants SET beneficiary=$1 WHERE id=$2",
          ["otto", grantA],
        ),
        /append-only/,
      )
      await assert.rejects(
        pool.query(
          "DELETE FROM deploy_exemption_revocations WHERE grant_id=$1",
          [grantA],
        ),
        /append-only/,
      )
    }))
test("cross-tenant projects and foreign grant revocations fail at the database boundary", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await assert.rejects(
      pool.query(
        `INSERT INTO deploy_exemption_grants(tenant_id,project_id,beneficiary,starts_at,issued_by,reason) VALUES($1,$2,'jose',now(),'admin','fixture')`,
        [tenantA, projectB],
      ),
      /foreign key/,
    )
    await grant(pool)
    await assert.rejects(
      loadHostingPolicy(
        { tenantId: tenantB, projectId: projectA },
        new Date(),
        pool,
      ),
      /not found/,
    )
    await assert.rejects(
      pool.query(
        `INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,now(),'admin','fixture')`,
        [grantA, tenantB],
      ),
      /foreign key/,
    )
    await assert.rejects(
      pool.query(
        `INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,'2026-09-01','admin','fixture')`,
        [grantA, tenantA],
      ),
      /precedes/,
    )
  }))
test("tenant-wide exemption covers owned projects, never unrelated superadmin memberships", async () =>
  withDeployDatabase(async (pool) => {
    await applyFoundation(pool)
    await grant(pool, "bayamon", null)
    await pool.query(
      "CREATE TABLE fixture_memberships(tenant_id uuid, is_superadmin boolean)",
    )
    await pool.query("INSERT INTO fixture_memberships VALUES($1,true)", [
      tenantB,
    ])
    assert.equal(
      (
        await loadHostingPolicy(
          { tenantId: tenantA, projectId: projectA2 },
          new Date("2026-10-10"),
          pool,
        )
      ).exempt,
      true,
    )
    assert.equal(
      (
        await loadHostingPolicy(
          { tenantId: tenantB, projectId: projectB },
          new Date("2026-10-10"),
          pool,
        )
      ).exempt,
      false,
    )
  }))
