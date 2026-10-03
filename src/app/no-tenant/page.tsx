import { Logo } from "@/components/logo"

export default function NoTenantPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm">
        <Logo size="lg" />
        <h1 className="mt-10 text-2xl font-semibold tracking-tight">Workspace access unavailable</h1>
        <p className="mt-2 text-sm text-muted">
          You are signed in, but have no eligible workspace in Developer. Ask your organization administrator to review your access, or finish onboarding in the members portal.
        </p>
        <a className="btn-primary mt-6" href="https://members.axxes.club/onboarding">Open members portal</a>
      </div>
    </main>
  )
}
