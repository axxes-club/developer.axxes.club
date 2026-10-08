'use client'
import {useState} from 'react'

async function open(path:string,body?:object){
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body??{})})
  const d=await r.json().catch(()=>({}))
  if(!r.ok||!d.url)throw new Error(d.message||'Something went wrong')
  window.location.href=d.url
}

/** Subscribe (monthly or yearly) to an API plan, or manage the current one. Payment is taken on AXXES Payments. */
export function PlanBilling({plan,monthly,annual,mode}:{plan:string;monthly:number;annual:number|null;mode:'subscribe'|'manage'|'none'}){
  const[busy,setBusy]=useState<string|null>(null)
  const[error,setError]=useState<string|null>(null)
  const run=async(key:string,path:string,body?:object)=>{setBusy(key);setError(null);try{await open(path,body)}catch(e){setError(e instanceof Error?e.message:'Something went wrong');setBusy(null)}}
  if(mode==='none')return null
  return <div className="mt-5 space-y-2">
    {mode==='manage'
      ?<button className="btn-ghost w-full" disabled={busy!==null} onClick={()=>run('manage','/api/billing/portal')}>{busy?'Opening…':'Manage subscription'}</button>
      :<>
        <button className="btn-primary w-full" disabled={busy!==null} onClick={()=>run('monthly','/api/billing/checkout',{plan,interval:'monthly'})}>{busy==='monthly'?'Opening checkout…':`Subscribe · $${(monthly/100).toFixed(0)}/month`}</button>
        {annual?<button className="btn-ghost w-full" disabled={busy!==null} onClick={()=>run('annual','/api/billing/checkout',{plan,interval:'annual'})}>{busy==='annual'?'Opening checkout…':`Subscribe yearly · $${(annual/100).toLocaleString()}/year`}</button>:null}
      </>}
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>
}
