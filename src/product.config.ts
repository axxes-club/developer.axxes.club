import { defineProduct } from "@/lib/product"

/**
 * The portal's structure.
 *
 * Ordered the way a developer actually arrives: get something working
 * first, then build on it, then look things up, then look after the bill.
 * Reference sits near the bottom deliberately — a page you read once per
 * call is not a page you navigate through.
 */
export const product = defineProduct({
  name: "AXXES Developers",
  tagline: "Every AXXES API, in one account.",
  accent: "#c8ff3d",
  sections: [
    { href: "/dashboard/developer", label: "Overview", group: "Get started" },
    { href: "/dashboard/developer/quickstart", label: "Quickstart", group: "Get started" },
    { href: "/dashboard/developer/prompts", label: "AI prompts", group: "Build" },
    { href: "/dashboard/developer/docs", label: "API reference", group: "Reference" },
    { href: "/dashboard/developer/guides", label: "Integration guides", group: "Reference" },
    { href: "/dashboard/developer/changelog", label: "Changelog", group: "Reference" },
    { href: "/dashboard/developer/plans", label: "API plan limits", group: "Account" },
  ],
})
