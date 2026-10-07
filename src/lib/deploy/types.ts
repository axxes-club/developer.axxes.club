export type HostingSubject = { tenantId: string; projectId: string }
export type ExemptionGrant = {
  id: string
  tenantId: string
  projectId: string | null
  beneficiary: "jose" | "bayamon" | "otto"
  startsAt: Date
  endsAt: Date | null
}
export type HostingPolicy = {
  exempt: boolean
  grantId: string | null
  paymentRequired: boolean
  chargeUsage: boolean
  enforceBillingBudget: boolean
}
