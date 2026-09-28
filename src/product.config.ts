import { defineProduct } from "@/lib/product"

export const product = defineProduct({
  name: "AXXES for Developers",
  tagline: "Build on every AXXES product from one account, one key, one bill.",
  accent: "#c8ff3d",
  nav: [
    { href: "/dashboard/developer", label: "Overview" },
    { href: "/dashboard/developer/apps", label: "Apps" },
    { href: "/dashboard/developer/keys", label: "API keys" },
    { href: "/dashboard/developer/usage", label: "Usage" },
    { href: "/dashboard/developer/docs", label: "API reference" },
    { href: "/dashboard/developer/prompts", label: "Prompt library" },
    { href: "/dashboard/developer/plans", label: "Plans" },
  ],
  resources: [],
})
