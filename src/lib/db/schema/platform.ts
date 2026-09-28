import { pgTable, text, timestamp, uuid, integer, jsonb, pgEnum, index, uniqueIndex, boolean, bigint } from "drizzle-orm/pg-core"
import { user } from "./users"
import { tenants } from "./tenants"

/* ══════════════════════════════════════════════════════════════════════
   Plans

   Every tenant is on "free" today and there is no plan table, so what a
   plan entitles anyone to was, until now, only in someone's head. This
   makes it data: one row per plan, and the limits as columns rather than
   prose, so enforcement is a comparison and the pricing page cannot drift
   from what the gateway actually allows.
   ══════════════════════════════════════════════════════════════════════ */

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),            // free | build | scale
    name: text("name").notNull(),
    blurb: text("blurb"),
    // Monthly price in cents. Never a float: money is not a float.
    priceCents: integer("price_cents").notNull().default(0),
    annualPriceCents: integer("annual_price_cents"),
    // Hard ceilings, enforced by the gateway. Null = not limited.
    monthlyApiCalls: integer("monthly_api_calls"),
    dailyApiCalls: integer("daily_api_calls"),
    maxApps: integer("max_apps"),
    maxKeysPerApp: integer("max_keys_per_app"),
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    // Which products this plan can reach at all.
    products: jsonb("products").$type<string[]>().notNull().default([]),
    // Which API surfaces are unlocked. This is the paywall.
    features: jsonb("features").$type<string[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("plans_key_idx").on(table.key), index("plans_position_idx").on(table.position)],
)

/** Which plan a workspace is on. Denormalised from tenants.subscription_tier. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    planKey: text("plan_key").notNull().default("free"),
    status: text("status").notNull().default("active"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    // Set when the plan changes, so a downgrade can be honoured at period end
    // rather than instantly stranding whatever is running.
    pendingPlanKey: text("pending_plan_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("subscriptions_tenant_idx").on(table.tenantId)],
)

/* ══════════════════════════════════════════════════════════════════════
   Apps

   Registering an app is what makes the platform an ecosystem: it names who
   is building what, which products it touches, and which callbacks and
   scopes it needs. The OAuth client lives here too, so one registration
   gives both "sign in with AXXES" and API access.
   ══════════════════════════════════════════════════════════════════════ */

export const appStatusEnum = pgEnum("app_status", ["draft", "active", "suspended"])

export const apps = pgTable(
  "apps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),

    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    // Where the app actually lives.
    homepageUrl: text("homepage_url"),
    logoUrl: text("logo_url"),
    // Exactly the callbacks we will redirect to. No wildcards: this is the
    // value an attacker controls, so a loose match here steals accounts.
    redirectUris: jsonb("redirect_uris").$type<string[]>().notNull().default([]),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    products: jsonb("products").$type<string[]>().notNull().default([]),

    status: appStatusEnum("status").notNull().default("draft"),
    // OAuth client credentials. Hashed like every other secret here.
    clientId: text("client_id").notNull(),
    clientSecretHash: text("client_secret_hash"),

    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("apps_tenant_slug_idx").on(table.tenantId, table.slug),
    uniqueIndex("apps_client_id_idx").on(table.clientId),
  ],
)

/** A key an app uses against a product's API. */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    // "lnk_<id>_<secret>" style: id locates the row, secret is verified.
    keyId: text("key_id").notNull(),
    hash: text("hash"),
    prefix: text("prefix"),
    name: text("name").notNull(),
    products: jsonb("products").$type<string[]>().notNull().default([]),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastUsedIp: text("last_used_ip"),
    useCount: integer("use_count").notNull().default(0),
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_keys_key_id_idx").on(table.keyId),
    uniqueIndex("api_keys_hash_idx").on(table.hash),
    index("api_keys_app_idx").on(table.appId),
    index("api_keys_tenant_idx").on(table.tenantId),
  ],
)

/* ══════════════════════════════════════════════════════════════════════
   Metering

   One row per request, rolled up on read. Writing a row per call is the
   only way to answer "what did we serve, to whom, and did it stay inside
   the plan" after the fact, which is the question both a customer and an
   auditor will ask.
   ══════════════════════════════════════════════════════════════════════ */

export const usageEvents = pgTable(
  "usage_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    tenantId: uuid("tenant_id").notNull(),
    appId: uuid("app_id"),
    keyId: text("key_id"),
    product: text("product").notNull(),      // lanes, nexus, krates, ...
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull(),
    status: integer("status").notNull(),
    billable: boolean("billable").notNull().default(true),
    latencyMs: integer("latency_ms"),
    // Bytes in, so "unlimited" can still mean something.
    bytesIn: bigint("bytes_in", { mode: "number" }),
    errorCode: text("error_code"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("usage_events_tenant_time_idx").on(table.tenantId, table.occurredAt),
    index("usage_events_app_time_idx").on(table.appId, table.occurredAt),
    index("usage_events_product_time_idx").on(table.product, table.occurredAt),
  ],
)

/** Pre-aggregated so the usage page is a single read, not a scan. */
export const usageDaily = pgTable(
  "usage_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    day: timestamp("day", { withTimezone: true }).notNull(),
    product: text("product").notNull(),
    appId: uuid("app_id"),
    calls: bigint("calls", { mode: "number" }).notNull().default(0),
    errors: bigint("errors", { mode: "number" }).notNull().default(0),
    bytesIn: bigint("bytes_in", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("usage_daily_idx").on(table.tenantId, table.day, table.product, table.appId),
    index("usage_daily_day_idx").on(table.day),
  ],
)

export type Plan = typeof plans.$inferSelect
export type App = typeof apps.$inferSelect
export type ApiKey = typeof apiKeys.$inferSelect
