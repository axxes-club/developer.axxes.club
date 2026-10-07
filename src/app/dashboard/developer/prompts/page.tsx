import {DeveloperFrame} from '@/components/developer/page-frame'
import {API_PRODUCTS} from '@/lib/registry/api'
export const metadata={title:'AI prompts — AXXES.dev'}
export default function Prompts(){return <DeveloperFrame title="AI prompts" description="Copy endpoint-specific instructions into your coding assistant. Never include secrets.">
 {API_PRODUCTS.flatMap(p=>p.resources.flatMap(r=>r.operations.filter(op=>op.authentication!=='session').map(op=><section key={op.id} className="card p-5"><h2 className="font-semibold">{p.name}: {op.summary}</h2><pre className="mt-3 whitespace-pre-wrap break-words text-sm">{`Build a server-side integration for ${p.name}.
Endpoint: ${op.method} ${p.baseUrl}${op.path}
Purpose: ${op.description}
Required permission: ${op.requires}
Read credentials from server environment variables. Never expose or log secrets. Ask for real organization record IDs rather than inventing them. Handle these documented errors: ${op.errors.map(e=>`${e.status}: ${e.meaning}`).join('; ')}.
Response example: ${JSON.stringify(op.response)}`}</pre></section>)))}
 </DeveloperFrame>}
