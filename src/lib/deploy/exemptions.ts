import type { Pool, PoolClient } from "pg"
import { hostingPool } from "./postgres"
import { resolveHostingPolicy } from "./policy"
import type { HostingSubject, HostingPolicy, ExemptionGrant } from "./types"

export async function loadHostingPolicy(
  subject: HostingSubject,
  at: Date = new Date(),
  connection: Pool | PoolClient = hostingPool(),
): Promise<HostingPolicy> {
  const project = await connection.query(
    "SELECT id FROM deploy_projects WHERE tenant_id=$1 AND id=$2",
    [subject.tenantId, subject.projectId],
  )
  if (!project.rowCount) throw new Error("Hosting project not found")
  const { rows } = await connection.query(
    `SELECT g.id, g.tenant_id, g.project_id, g.beneficiary, g.starts_at, r.ends_at
    FROM deploy_exemption_grants g LEFT JOIN deploy_exemption_revocations r ON r.grant_id=g.id AND r.tenant_id=g.tenant_id
    WHERE g.tenant_id=$1 AND (g.project_id IS NULL OR g.project_id=$2)`,
    [subject.tenantId, subject.projectId],
  )
  const grants: ExemptionGrant[] = rows.map((g) => ({
    id: g.id,
    tenantId: g.tenant_id,
    projectId: g.project_id,
    beneficiary: g.beneficiary,
    startsAt: g.starts_at,
    endsAt: g.ends_at ?? null,
  }))
  return resolveHostingPolicy(subject, at, grants)
}
