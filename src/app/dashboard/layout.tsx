import { requireContext } from "@/lib/context"
import { Sidebar } from "@/components/sidebar"
import { SignOut } from "@/components/sign-out"
import { Logo } from "@/components/logo"
import { product } from "@/product.config"
import { OrgSwitcher } from "@/components/org-switcher"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext()
  const items = [
    ...(product.nav ?? []).map((n) => ({ href: n.href, label: n.label })),
  ]

  return (
    <div className="lg:flex">
      <Sidebar
        items={items}
        logo={<Logo />}
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
