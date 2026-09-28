/**
 * What this product is.
 *
 * developer.axxes.club is the AXXES developer console and documentation
 * portal: the API reference for every AXXES product, the guides for
 * integrating with them, and the console where an app is registered and
 * its keys and usage managed.
 *
 * It is deliberately NOT a knowledge base. It shares a session and a
 * database with the rest of the AXXES suite, but it has its own model:
 * documentation and an API surface, not pages and blocks.
 */

export type Section = {
  href: string
  label: string
  /** Shown in the sidebar, one level in. */
  group: "Get started" | "Build" | "Reference" | "Account"
}

export type Product = {
  name: string
  tagline: string
  /** Brand accent, used for focus rings and the wordmark rule. */
  accent: string
  sections: Section[]
}

export function defineProduct(p: Product) {
  return p
}
