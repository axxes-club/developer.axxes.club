import type { Metadata } from "next"
import { BrandScope } from "@/components/brand"
import { getCustomerBrand } from "@/lib/white-label"
import { requireContext } from "@/lib/context"
import { Sidebar } from "@/components/sidebar"
import { SignOut } from "@/components/sign-out"
import { Logo, LogoMark } from "@/components/logo"
import { product } from "@/product.config"
import { OrgSwitcher } from "@/components/org-switcher"

async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext()
  // Grouped in the sidebar the same way the config is ordered, so the page
  // and the navigation cannot drift apart.
  const items = product.sections.map((s) => ({ href: s.href, label: s.label }))

  return (
    <div className="lg:flex">
      <Sidebar
        items={items}
        logo={<Logo />}
        mark={<LogoMark />}
        footer={
          <div className="space-y-3 text-xs">
            <OrgSwitcher
              current={{
                tenantId: ctx.tenant.id,
                name: ctx.tenant.name,
                slug: ctx.tenant.slug,
                role: ctx.role,
                isPrimary: ctx.memberships.some((m) => m.isPrimary && m.tenantId === ctx.tenant.id),
              }}
              memberships={ctx.memberships}
            />
            <p className="truncate text-muted">{ctx.user.email}</p>
            <div className="flex items-center justify-between">
              <a className="text-muted hover:text-text" href="https://handshake.axxes.club">← AXXES apps</a>
              <SignOut />
            </div>
          </div>
        }
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}

/** White-label customers see their own brand; everyone else, standard AXXES. */
export default async function BrandedLayout(props: Parameters<typeof DashboardLayout>[0]) {
  const ctx = await requireContext()
  const brand = ctx ? await getCustomerBrand(ctx.tenant.id) : null
  return <BrandScope brand={brand}>{await DashboardLayout(props)}</BrandScope>
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireContext()
  const brand = ctx ? await getCustomerBrand(ctx.tenant.id) : null
  return brand?.faviconUrl ? { icons: { icon: brand.faviconUrl } } : {}
}
