'use client'

export default function CloudError({reset}:{error:Error & {digest?:string};reset:()=>void}){
  return <main className="mx-auto max-w-xl px-5 py-16">
    <h1 className="text-2xl font-semibold">Cloud is temporarily unavailable</h1>
    <p className="mt-3 text-sm text-muted">We could not load this page. Try again to check the current state of your resources.</p>
    <button onClick={reset} className="btn-primary mt-6">Try again</button>
  </main>
}
