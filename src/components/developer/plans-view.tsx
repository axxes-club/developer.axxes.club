import {DeveloperFrame} from '@/components/developer/page-frame'
import {PlanBilling} from '@/components/developer/plan-billing'
import {PLANS} from '@/lib/plans/catalog'

const RETURNED:Record<string,string>={success:'Payment confirmed. Your API plan is active.',incomplete:'Checkout was not completed. You have not been charged.'}

export type PlansBilling={workspace:string;planName:string;currentKey:string|null;exempt:boolean;canManage:boolean;returned?:string}

/** API plan catalog, plus this workspace's plan and checkout when `billing` is given. Pure, so it renders in tests. */
export function PlansView({billing}:{billing?:PlansBilling}){
 const sell=!!billing&&billing.canManage&&!billing.exempt
 return <DeveloperFrame title="API plans" description="API catalog limits for this workspace. App and website hosting is priced separately and is not included.">
 {billing?.returned&&RETURNED[billing.returned]&&<p role="status" className="card p-4 text-sm">{RETURNED[billing.returned]}</p>}
 {billing&&<p className="text-sm text-muted">{billing.exempt?`${billing.workspace} is an AXXES workspace and is not billed for API plans.`:`${billing.workspace} is on the ${billing.planName} plan.`} {sell?'Payments are processed by AXXES Payments. Cancel any time; the plan runs to the end of the paid period.':!billing.exempt?'Only workspace owners and admins can change the plan.':''}</p>}
 <div className="grid gap-4 sm:grid-cols-3">{PLANS.map(p=><section key={p.key} className="card p-5"><h2 className="font-semibold">{p.name}{billing?.currentKey===p.key&&<span className="ml-2 text-xs text-muted">Current</span>}</h2><p className="mt-1 text-sm text-muted">{p.priceCents?`$${(p.priceCents/100).toFixed(0)}/month`:'Free'}</p><ul className="mt-4 space-y-2 text-sm text-muted"><li>Monthly API calls: {p.limits.monthlyApiCalls?.toLocaleString()??'Unlimited'}</li><li>Requests per minute: {p.limits.rateLimitPerMinute??'Unlimited'}</li><li>Products: {p.products.join(', ')}</li></ul>
  {sell&&p.priceCents>0&&<PlanBilling plan={p.key} monthly={p.priceCents} annual={p.annualPriceCents} mode={billing.currentKey===p.key?'manage':billing.currentKey==='free'?'subscribe':'none'}/>}
 </section>)}</div>
 <p className="text-sm text-muted">The Free API plan does not permit free app deployments. Free app deployment is reserved exclusively for Jose&apos;s verified account.</p>
 </DeveloperFrame>}
