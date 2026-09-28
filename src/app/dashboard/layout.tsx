import { requireContext } from "@/lib/context"
import { Sidebar } from "@/components/sidebar"
import { SignOut } from "@/components/sign-out"
import { Logo } from "@/components/logo"
import { product } from "@/product.config"

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
            <div>
              <p className="font-medium text-text">{ctx.tenant.name}</p>
              <p className="truncate text-muted">{ctx.user.email}</p>
            </div>
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
