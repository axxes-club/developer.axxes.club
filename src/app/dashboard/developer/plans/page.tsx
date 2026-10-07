import {DeveloperFrame} from '@/components/developer/page-frame'
import {PLANS} from '@/lib/plans/catalog'
export const metadata={title:'API plan limits — AXXES.dev'}
export default function Plans(){return <DeveloperFrame title="API plan limits" description="API catalog limits. App and website hosting is priced separately and is not included.">
 <p className="text-sm text-muted">These are the API plan definitions, not your organization's billing statement. Plan changes and checkout are not available from this page.</p>
 <div className="grid gap-4 sm:grid-cols-3">{PLANS.map(p=><section key={p.key} className="card p-5"><h2 className="font-semibold">{p.name}</h2><ul className="mt-4 space-y-2 text-sm text-muted"><li>Monthly API calls: {p.limits.monthlyApiCalls?.toLocaleString()??'Unlimited'}</li><li>Requests per minute: {p.limits.rateLimitPerMinute??'Unlimited'}</li><li>Products: {p.products.join(', ')}</li></ul></section>)}</div>
 <p className="text-sm text-muted">The Free API plan does not permit free app deployments. Free app deployment is reserved exclusively for Jose's verified account.</p>
 </DeveloperFrame>}
