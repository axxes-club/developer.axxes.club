import Link from 'next/link'
import {Logo} from '@/components/logo'
export const metadata={title:'AXXES.dev — developer resources',description:'API reference, integration guides and developer resources for AXXES products.'}
export default function Home(){return <div className="min-h-dvh">
 <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5"><Logo/><Link href="/dashboard/developer" className="btn-primary">Open developer portal</Link></header>
 <main className="mx-auto max-w-6xl px-5 py-20"><p className="font-mono text-xs uppercase tracking-widest text-accent">AXXES.dev</p><h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">Build with AXXES.</h1><p className="mt-6 max-w-2xl text-lg text-muted">API documentation, request examples and integration guides for the AXXES products your organization uses.</p><Link href="/dashboard/developer" className="btn-primary mt-8 inline-flex">Explore developer resources →</Link>
 <div className="mt-16 grid gap-4 sm:grid-cols-3">{[['API reference','Endpoint details, permissions and response examples.'],['Integration guides','Credential handling, organization access and error recovery.'],['AI prompts','Endpoint-specific instructions for your coding assistant.']].map(([title,body])=><section key={title} className="card p-6"><h2 className="font-semibold">{title}</h2><p className="mt-3 text-sm text-muted">{body}</p></section>)}</div>
 </main><footer className="mx-auto max-w-6xl border-t border-line px-5 py-8 text-sm text-muted"><a href="https://handshake.axxes.club/apps">All AXXES apps →</a></footer>
 </div>}
