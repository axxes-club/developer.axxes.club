import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  unique,
  foreignKey,
  numeric,
  index,
} from "drizzle-orm/pg-core"
import { tenants } from "./tenants"
const time = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow()
export const deployProjects = pgTable(
  "deploy_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    region: text("region").notNull().default("us-west1"),
    runtimeClass: text("runtime_class").notNull().default("static"),
    createdAt: time("created_at"),
  },
  (t) => [unique().on(t.tenantId, t.id)],
)
export const deployBillingAccounts = pgTable("deploy_billing_accounts", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  availableMicroUsd: bigint("available_micro_usd", { mode: "bigint" })
    .notNull()
    .default(0n),
  updatedAt: time("updated_at"),
})
export const deployExemptionGrants = pgTable(
  "deploy_exemption_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id"),
    beneficiary: text("beneficiary").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    issuedBy: text("issued_by").notNull(),
    reason: text("reason").notNull(),
    issuedAt: time("issued_at"),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.projectId],
      foreignColumns: [deployProjects.tenantId, deployProjects.id],
    }),
  ],
)
export const deployExemptionRevocations = pgTable(
  "deploy_exemption_revocations",
  {
    grantId: uuid("grant_id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    issuedBy: text("issued_by").notNull(),
    reason: text("reason").notNull(),
    issuedAt: time("issued_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.grantId],
      foreignColumns: [
        deployExemptionGrants.tenantId,
        deployExemptionGrants.id,
      ],
    }),
  ],
)

export const deployRateVersions = pgTable("deploy_rate_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  region: text("region").notNull(),
  runtimeClass: text("runtime_class").notNull(),
  unit: text("unit").notNull(),
  numerator: bigint("numerator", { mode: "bigint" }).notNull(),
  denominator: bigint("denominator", { mode: "bigint" }).notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  createdAt: time("created_at"),
})

export const deployUsageEntries = pgTable(
  "deploy_usage_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    provider: text("provider").notNull(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    quantity: bigint("quantity", { mode: "bigint" }).notNull(),
    unit: text("unit").notNull(),
    rateVersionId: uuid("rate_version_id")
      .notNull()
      .references(() => deployRateVersions.id),
    exemptionGrantId: uuid("exemption_grant_id"),
    priceNumerator: numeric("price_numerator", {
      precision: 78,
      scale: 0,
    }).notNull(),
    priceDenominator: numeric("price_denominator", {
      precision: 78,
      scale: 0,
    }).notNull(),
    recordedAt: time("recorded_at"),
  },
  (t) => [
    unique().on(t.provider, t.source, t.sourceId),
    unique().on(t.tenantId, t.projectId, t.id),
    index("deploy_usage_subject_time").on(
      t.tenantId,
      t.projectId,
      t.occurredAt,
    ),
    foreignKey({
      columns: [t.tenantId, t.projectId],
      foreignColumns: [deployProjects.tenantId, deployProjects.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.exemptionGrantId],
      foreignColumns: [
        deployExemptionGrants.tenantId,
        deployExemptionGrants.id,
      ],
    }),
  ],
)
export const deployBillingAdjustments = pgTable(
  "deploy_billing_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    usageEntryId: uuid("usage_entry_id").notNull(),
    sourceId: text("source_id").notNull(),
    amountMicroUsd: bigint("amount_micro_usd", { mode: "bigint" }).notNull(),
    payloadHash: text("payload_hash").notNull(),
    issuedBy: text("issued_by").notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    recordedAt: time("recorded_at"),
  },
  (t) => [
    unique().on(t.tenantId, t.projectId, t.sourceId),
    foreignKey({
      columns: [t.tenantId, t.projectId, t.usageEntryId],
      foreignColumns: [
        deployUsageEntries.tenantId,
        deployUsageEntries.projectId,
        deployUsageEntries.id,
      ],
    }),
  ],
)
export const deployBudgetReservations = pgTable(
  "deploy_budget_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    operationId: text("operation_id").notNull(),
    amountMicroUsd: bigint("amount_micro_usd", { mode: "bigint" }).notNull(),
    exemptionGrantId: uuid("exemption_grant_id"),
    state: text("state").notNull().default("reserved"),
    actualMicroUsd: bigint("actual_micro_usd", { mode: "bigint" }),
    chargedMicroUsd: bigint("charged_micro_usd", { mode: "bigint" }),
    createdAt: time("created_at"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.tenantId, t.projectId, t.operationId),
    foreignKey({
      columns: [t.tenantId, t.projectId],
      foreignColumns: [deployProjects.tenantId, deployProjects.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.exemptionGrantId],
      foreignColumns: [
        deployExemptionGrants.tenantId,
        deployExemptionGrants.id,
      ],
    }),
  ],
)
