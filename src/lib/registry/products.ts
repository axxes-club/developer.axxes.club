/**
 * The AXXES product registry — one list, used by the docs index, the app
 * registration form and the plan pages.
 *
 * It is data rather than a crawl because these products live in separate
 * repos on separate schedules: a crawler would go stale silently and the
 * docs would start describing endpoints that no longer exist. A person
 * adding a product here cannot make that mistake quietly.
 *
 * `apiSurface` is the honest one: what a product actually exposes today.
 * "none" means the product exists and is reachable in the suite, but has
 * no public API yet, and the docs say so rather than showing an empty page.
 */
export type ProductEntry = {
  key: string
  name: string
  category: string
  url: string
  color: string
  /** Where a developer would look for this product's reference. */
  docsPath: string | null
  apiSurface: "none" | "read" | "read-write" | "beta"
  /** Why it is what it is, shown in the docs index. */
  note: string
}

export const PRODUCTS: ProductEntry[] = [
  { key: "lanes", name: "Lanes", category: "Work", url: "https://lanes.axxes.club", color: "#6366f1", docsPath: "/dashboard/developer/docs/lanes", apiSurface: "read-write", note: "Boards, sprints, scrum poker and custom fields." },
  { key: "nexus", name: "Nexus", category: "Work", url: "https://nexus.axxes.club", color: "#2dd4bf", docsPath: "/dashboard/developer/docs/nexus", apiSurface: "read-write", note: "Knowledge base, with tokens and AI import." },
  { key: "folders", name: "Folders", category: "Work", url: "https://folders.axxes.club", color: "#3b82f6", docsPath: null, apiSurface: "none", note: "File manager. No public API yet — ask if you need one." },
  { key: "pulse", name: "Pulse", category: "Work", url: "https://pulse.axxes.club", color: "#ef4444", docsPath: null, apiSurface: "none", note: "Live workspace vitals. No public API yet." },
  { key: "vitrine", name: "Vitrine", category: "Work", url: "https://vitrine.axxes.club", color: "#8a7a5c", docsPath: null, apiSurface: "none", note: "The collection desk. No public API yet." },
  { key: "krates", name: "Krates", category: "Commerce", url: "https://kr8s.axxes.club", color: "#f59e0b", docsPath: null, apiSurface: "none", note: "Inventory and requests. No public API yet." },
  { key: "manifest", name: "Manifest", category: "Commerce", url: "https://manifest.axxes.club", color: "#10b981", docsPath: null, apiSurface: "none", note: "Purchasing and transfers. No public API yet." },
  { key: "tollbooth", name: "Tollbooth", category: "Commerce", url: "https://tollbooth.axxes.club", color: "#8b5cf6", docsPath: null, apiSurface: "beta", note: "Payments on Stripe. API in private beta." },
  { key: "afters", name: "afters.am", category: "Events", url: "https://afters.am", color: "#f43f5e", docsPath: "/dashboard/developer/docs/afters", apiSurface: "read-write", note: "Events, tickets, orders, scanning and webhooks." },
  { key: "vibez", name: "Vibez", category: "Events", url: "https://vibez.axxes.club", color: "#a855f7", docsPath: null, apiSurface: "beta", note: "Attendee photo feed. API in beta." },
  { key: "qortr", name: "Qortr", category: "Events", url: "https://qortr.axxes.club", color: "#0ea5e9", docsPath: null, apiSurface: "none", note: "Room booking. No public API yet." },
  { key: "members", name: "AXXES Suite", category: "Suite", url: "https://members.axxes.club", color: "#ededef", docsPath: null, apiSurface: "read", note: "CRM, orders, contacts and your workspace." },
]

export function productByKey(key: string): ProductEntry | undefined {
  return PRODUCTS.find((p) => p.key === key)
}

export function productsWithApi(): ProductEntry[] {
  return PRODUCTS.filter((p) => p.apiSurface !== "none")
}
