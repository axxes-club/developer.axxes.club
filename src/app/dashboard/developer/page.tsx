import Link from 'next/link'
import {requireContext} from '@/lib/context'
import {DeveloperFrame} from '@/components/developer/page-frame'
import {product} from '@/product.config'
export const metadata={title:'Overview — AXXES.dev'}
export const dynamic='force-dynamic'
export default async function DeveloperPage(){
 const ctx=await requireContext()
 return <DeveloperFrame title="AXXES.dev" description="API documentation and integration resources for your AXXES organization.">
  <section className="card p-5"><h2 className="font-semibold">{ctx.tenant.name}</h2><p className="mt-2 text-sm text-muted">Signed in as {ctx.user.email} · {ctx.role}</p></section>
  <div className="grid gap-4 sm:grid-cols-2">{product.sections.filter(s=>s.href!=='/dashboard/developer').map(s=><Link key={s.href} href={s.href} className="card p-5 hover:border-accent"><h2 className="font-semibold">{s.label}</h2><p className="mt-2 text-sm text-muted">Open {s.label.toLowerCase()} →</p></Link>)}</div>
  <section className="card p-5"><h2 className="font-semibold">App and website hosting</h2><p className="mt-2 text-sm text-muted">AXXES Deploy is being prepared for customers moving from Vercel. Customer deployment is not available yet. Free app deployment is reserved exclusively for Jose's verified account; other customers will require paid hosting.</p></section>
 </DeveloperFrame>
}
