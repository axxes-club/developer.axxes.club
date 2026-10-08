import {PlansView} from '@/components/developer/plans-view'
import {gateFor} from '@/lib/plans/gate'
import {canManageBilling} from '@/lib/plans/billing-catalog'
import {requireContext} from '@/lib/context'
export const metadata={title:'API plans — AXXES.dev'}
export const dynamic='force-dynamic'
export default async function Plans({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const ctx=await requireContext()
 const gate=await gateFor(ctx.tenant.id)
 const returned=(await searchParams).subscription
 return <PlansView billing={{workspace:ctx.tenant.name,planName:gate.plan.name,currentKey:gate.exempt?null:gate.plan.key,exempt:gate.exempt,canManage:canManageBilling(ctx.role),returned:typeof returned==='string'?returned:undefined}}/>
}
