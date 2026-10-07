import {DeveloperFrame} from '@/components/developer/page-frame'
export const metadata={title:'Changelog — AXXES.dev'}
export default function Changelog(){return <DeveloperFrame title="Changelog" description="Changes to the developer portal.">
 <article className="card p-5"><time className="text-sm text-muted">October 7, 2026</time><h2 className="mt-2 font-semibold">Developer navigation restored</h2><p className="mt-2 text-sm text-muted">Quickstart, API reference, integration guides, AI prompts and API plan limits now have working pages. Unavailable management tools are hidden from navigation.</p></article>
 <article className="card p-5"><time className="text-sm text-muted">October 7, 2026</time><h2 className="mt-2 font-semibold">AXXES Deploy foundation</h2><p className="mt-2 text-sm text-muted">Hosting billing and source-intake groundwork is deployed. Customer app deployment is not available yet. Free deployment eligibility belongs exclusively to Jose's verified account.</p></article>
 </DeveloperFrame>}
