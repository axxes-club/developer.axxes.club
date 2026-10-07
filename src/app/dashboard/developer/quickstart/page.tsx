import Link from 'next/link'
import {DeveloperFrame} from '@/components/developer/page-frame'
export const metadata={title:'Quickstart — AXXES.dev'}
export default function Quickstart(){return <DeveloperFrame title="Quickstart" description="Make your first request to an AXXES product API.">
 <ol className="list-decimal space-y-5 pl-5"><li>Open the product you want to integrate with and select your organization.</li><li>Create a credential using that product's developer settings. Keep secrets on your server and grant only the permissions your integration needs.</li><li>Find the product's base URL and an endpoint in the <Link className="text-accent" href="/dashboard/developer/docs">API reference</Link>. Replace example record IDs with IDs from your organization.</li><li>Send the request with the credential in the Authorization header. A 401 means the credential was rejected; a 403 means the requested access is not allowed.</li></ol>
 <p className="text-sm text-muted">This portal does not yet register customer apps or issue platform-wide API keys. Credentials and supported authentication methods belong to the product serving the endpoint.</p>
 </DeveloperFrame>}
