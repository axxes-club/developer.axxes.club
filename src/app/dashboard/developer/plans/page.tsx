import {DeveloperFrame} from '@/components/developer/page-frame'
import {PlanBilling} from '@/components/developer/plan-billing'
import {PLANS} from '@/lib/plans/catalog'
import {gateFor} from '@/lib/plans/gate'
import {canManageBilling} from '@/lib/plans/billing-catalog'
import {requireContext} from '@/lib/context'
export const metadata={title:'API plans — AXXES.dev'}
export const dynamic='force-dynamic'
const RETURNED:Record<string,string>={success:'Payment confirmed. Your API plan is active.',incomplete:'Checkout was not completed. You have not been charged.'}
export default async function Plans({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const ctx=await requireContext()
 const gate=await gateFor(ctx.tenant.id)
 const returned=(await searchParams).subscription
 const billing=canManageBilling(ctx.role)&&!gate.exempt
 const current=gate.exempt?null:gate.plan.key
 return <DeveloperFrame title="API plans" description="API catalog limits for this workspace. App and website hosting is priced separately and is not included.">
 {typeof returned==='string'&&RETURNED[returned]&&<p role="status" className="card p-4 text-sm">{RETURNED[returned]}</p>}
 <p className="text-sm text-muted">{gate.exempt?`${ctx.tenant.name} is an AXXES workspace and is not billed for API plans.`:`${ctx.tenant.name} is on the ${gate.plan.name} plan.`} {billing?'Payments are processed by AXXES Payments. Cancel any time; the plan runs to the end of the paid period.':!gate.exempt?'Only workspace owners and admins can change the plan.':''}</p>
 <div className="grid gap-4 sm:grid-cols-3">{PLANS.map(p=><section key={p.key} className="card p-5"><h2 className="font-semibold">{p.name}{current===p.key&&<span className="ml-2 text-xs text-muted">Current</span>}</h2><p className="mt-1 text-sm text-muted">{p.priceCents?`$${(p.priceCents/100).toFixed(0)}/month`:'Free'}</p><ul className="mt-4 space-y-2 text-sm text-muted"><li>Monthly API calls: {p.limits.monthlyApiCalls?.toLocaleString()??'Unlimited'}</li><li>Requests per minute: {p.limits.rateLimitPerMinute??'Unlimited'}</li><li>Products: {p.products.join(', ')}</li></ul>
  {billing&&p.priceCents>0&&<PlanBilling plan={p.key} monthly={p.priceCents} annual={p.annualPriceCents} mode={current===p.key?'manage':current==='free'?'subscribe':'none'}/>}
 </section>)}</div>
 <p className="text-sm text-muted">The Free API plan does not permit free app deployments. Free app deployment is reserved exclusively for Jose's verified account.</p>
 </DeveloperFrame>}
