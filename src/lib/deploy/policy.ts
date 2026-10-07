import type { ExemptionGrant, HostingPolicy, HostingSubject } from './types'

export function resolveHostingPolicy(subject: HostingSubject, at: Date, grants: readonly ExemptionGrant[]): HostingPolicy {
  if (!subject.tenantId || !subject.projectId || !Number.isFinite(at.getTime())) throw new Error('Invalid hosting subject or time')
  for (const grant of grants) {
    if (!['jose','bayamon','otto'].includes(grant.beneficiary) || !Number.isFinite(grant.startsAt.getTime()) || (grant.endsAt !== null && (!Number.isFinite(grant.endsAt.getTime()) || grant.endsAt < grant.startsAt))) throw new Error('Invalid exemption grant')
  }
  const grant = grants.filter(g => g.tenantId === subject.tenantId && (g.projectId === null || g.projectId === subject.projectId) && g.startsAt <= at && (g.endsAt === null || at < g.endsAt))
    .sort((a,b) => Number(b.projectId !== null) - Number(a.projectId !== null) || a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id))[0]
  return { exempt: !!grant, grantId: grant?.id ?? null, paymentRequired: !grant, chargeUsage: !grant, enforceBillingBudget: !grant }
}
