import { pgTable, uuid, text, timestamp, bigint, unique, foreignKey } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
const time = (name: string) => timestamp(name, {withTimezone: true}).notNull().defaultNow()
export const deployProjects = pgTable('deploy_projects', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull().references(()=>tenants.id),
  name: text('name').notNull(), createdAt: time('created_at'),
}, t=>[unique().on(t.tenantId,t.id)])
export const deployBillingAccounts = pgTable('deploy_billing_accounts', {
  tenantId: uuid('tenant_id').primaryKey().references(()=>tenants.id), availableMicroUsd: bigint('available_micro_usd',{mode:'bigint'}).notNull().default(0n), updatedAt: time('updated_at'),
})
export const deployExemptionGrants = pgTable('deploy_exemption_grants', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull().references(()=>tenants.id), projectId: uuid('project_id'),
  beneficiary: text('beneficiary').notNull(), startsAt: timestamp('starts_at',{withTimezone:true}).notNull(),
  issuedBy: text('issued_by').notNull(), reason: text('reason').notNull(), issuedAt: time('issued_at'),
},t=>[unique().on(t.tenantId,t.id),foreignKey({columns:[t.tenantId,t.projectId],foreignColumns:[deployProjects.tenantId,deployProjects.id]})])
export const deployExemptionRevocations = pgTable('deploy_exemption_revocations', {
  grantId: uuid('grant_id').primaryKey(), tenantId: uuid('tenant_id').notNull(), endsAt: timestamp('ends_at',{withTimezone:true}).notNull(),
  issuedBy: text('issued_by').notNull(), reason: text('reason').notNull(), issuedAt: time('issued_at'),
},t=>[foreignKey({columns:[t.tenantId,t.grantId],foreignColumns:[deployExemptionGrants.tenantId,deployExemptionGrants.id]})])

export const deployRateVersions = pgTable('deploy_rate_versions', {
  id: uuid('id').defaultRandom().primaryKey(), region: text('region').notNull(), runtimeClass: text('runtime_class').notNull(), unit: text('unit').notNull(),
  numerator: bigint('numerator',{mode:'bigint'}).notNull(), denominator: bigint('denominator',{mode:'bigint'}).notNull(),
  effectiveAt: timestamp('effective_at',{withTimezone:true}).notNull(), createdAt: time('created_at'),
})
