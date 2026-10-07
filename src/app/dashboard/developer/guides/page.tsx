import Link from 'next/link'
import {DeveloperFrame} from '@/components/developer/page-frame'
export const metadata={title:'Integration guides — AXXES.dev'}
export default function Guides(){return <DeveloperFrame title="Integration guides" description="Build integrations that respect organization boundaries and handle errors.">
 <section className="card p-5"><h2 className="font-semibold">Keep credentials private</h2><p className="mt-2 text-sm text-muted">Store credentials in server environment variables. Never include them in browser JavaScript, public repositories or request logs. Revoke a leaked credential in the issuing product.</p></section>
 <section className="card p-5"><h2 className="font-semibold">Handle failures</h2><p className="mt-2 text-sm text-muted">Do not retry authentication or permission failures blindly. For rate limits, respect Retry-After when present. Retry temporary failures with bounded backoff; only retry writes when the endpoint provides safe idempotency.</p></section>
 <section className="card p-5"><h2 className="font-semibold">Respect organization access</h2><p className="mt-2 text-sm text-muted">Use records belonging to the credential's organization. A missing record can also indicate that it belongs to another organization; never assume that knowing an ID grants access.</p></section>
 <Link className="text-accent" href="/dashboard/developer/docs">Browse endpoint examples →</Link>
 </DeveloperFrame>}
