/**
 * The plan catalog.
 *
 * This is the single source of truth for what a plan allows, and it is
 * deliberately not prose. The gateway reads these numbers to decide whether
 * to serve a call, and the pricing page renders the same objects, so the
 * page cannot promise something the gateway will refuse — which is the
 * normal way a pricing page starts lying.
 *
 * Prices are cents. Money is never a float.
 */
export type PlanFeature = { id: string; label: string; detail: string }

export type PlanDefinition = {
  key: string
  name: string
  blurb: string
  priceCents: number
  annualPriceCents: number | null
  limits: {
    monthlyApiCalls: number | null
    dailyApiCalls: number | null
    maxApps: number | null
    maxKeysPerApp: number | null
    rateLimitPerMinute: number | null
  }
  /** Products this plan can reach. */
  products: string[]
  /** Unlocked API surfaces. The paywall is this list. */
  features: string[]
  position: number
  includes: string[]
}

export const FEATURES: PlanFeature[] = [
  { id: "api.read", label: "Read APIs", detail: "Fetch data from your apps' products." },
  { id: "api.write", label: "Write APIs", detail: "Create and update records." },
  { id: "api.webhooks", label: "Webhooks", detail: "Real-time events pushed to your server." },
  { id: "oauth.login", label: "Sign in with AXXES", detail: "OAuth for your own product." },
  { id: "usage.dashboard", label: "Usage dashboard", detail: "Calls, errors and latency per app." },
  { id: "usage.export", label: "Usage export", detail: "Download your metering as CSV." },
  { id: "docs.all", label: "Full API reference", detail: "Every product, every endpoint." },
  { id: "prompts.library", label: "Prompt library", detail: "Generated prompts for every API." },
  { id: "support.email", label: "Email support", detail: "A real answer, within a day." },
  { id: "support.priority", label: "Priority support", detail: "A shared channel with the team." },
]

export const PLANS: PlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    blurb: "Build something real. No card, no time limit.",
    priceCents: 0,
    annualPriceCents: 0,
    limits: { monthlyApiCalls: 1_000, dailyApiCalls: 100, maxApps: 1, maxKeysPerApp: 1, rateLimitPerMinute: 10 },
    products: ["lanes", "nexus"],
    features: ["api.read", "usage.dashboard", "docs.all", "prompts.library"],
    position: 0,
    includes: [
      "1 app, 1 API key",
      "1,000 calls a month",
      "10 requests a minute",
      "Read-only access to Lanes and Nexus",
      "Usage dashboard",
      "Community support",
    ],
  },
  {
    key: "build",
    name: "Build",
    blurb: "For products in front of real users.",
    priceCents: 4900,
    annualPriceCents: 47000,
    limits: { monthlyApiCalls: 100_000, dailyApiCalls: 10_000, maxApps: 10, maxKeysPerApp: 5, rateLimitPerMinute: 120 },
    products: ["lanes", "nexus", "krates", "folders", "manifest"],
    features: [
      "api.read", "api.write", "api.webhooks", "oauth.login",
      "usage.dashboard", "usage.export", "docs.all", "prompts.library", "support.email",
    ],
    position: 1,
    includes: [
      "10 apps, 5 keys each",
      "100,000 calls a month",
      "120 requests a minute",
      "Read and write across Lanes, Nexus, Krates, Folders and Manifest",
      "Webhooks and Sign in with AXXES",
      "Usage export",
      "Email support",
    ],
  },
  {
    key: "scale",
    name: "Scale",
    blurb: "For platforms reselling AXXES to their own customers.",
    priceCents: 29900,
    annualPriceCents: 287000,
    limits: { monthlyApiCalls: null, dailyApiCalls: null, maxApps: null, maxKeysPerApp: null, rateLimitPerMinute: 1000 },
    products: ["lanes", "nexus", "krates", "folders", "manifest", "afters", "vibez", "qortr", "tollbooth", "vitrine", "pulse", "members"],
    features: FEATURES.map((f) => f.id),
    position: 2,
    includes: [
      "Unlimited apps and keys",
      "Negotiated call volume",
      "1,000 requests a minute",
      "Every AXXES product, including events and payments",
      "Priority support and a shared channel",
      "Custom limits and invoicing",
    ],
  },
]

export function planByKey(key: string | null | undefined): PlanDefinition {
  return PLANS.find((p) => p.key === (key ?? "free")) ?? PLANS[0]
}

/**
 * The highest plan we sell. Derived from the list rather than named, so adding
 * a tier later moves the ceiling for everyone who is exempt from billing
 * without anyone remembering to update a second place.
 */
export function topPlan(): PlanDefinition {
  return PLANS.reduce((best, p) => (p.position > best.position ? p : best), PLANS[0])
}

/**
 * A superadmin's effective plan: the top tier, with every ceiling removed.
 *
 * Deliberately derived rather than a plan of its own. A "superadmin plan" row
 * would be one more thing to forget to update when a tier is added, and the
 * day it is forgotten is the day an owner silently cannot reach something.
 */
export function unlimitedFrom(plan: PlanDefinition): PlanDefinition {
  return {
    ...plan,
    key: "superadmin",
    name: `${plan.name} (unlimited)`,
    blurb: "Everything the top plan includes, with no ceilings and no charge.",
    priceCents: 0,
    annualPriceCents: 0,
    limits: {
      monthlyApiCalls: null,
      dailyApiCalls: null,
      maxApps: null,
      maxKeysPerApp: null,
      rateLimitPerMinute: null,
    },
  }
}

/** Is this plan allowed to use this surface? The paywall, in one line. */
export function planAllows(planKey: string, feature: string): boolean {
  return planByKey(planKey).features.includes(feature)
}

export function planAllowsProduct(planKey: string, product: string): boolean {
  return planByKey(planKey).products.includes(product)
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free"
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`
}
