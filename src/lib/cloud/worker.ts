import {HostingAccessError} from '../deploy/authorization'
import {CloudError} from './types'
import type {ClaimedJob} from './jobs'
export type WorkerMode='dispatch'|'reconcile'|'cleanup'
export type WorkerOutcome={state:'pending'|'succeeded'|'failed';checkpoint?:unknown;errorCode?:string}
export type WorkerDependencies={validate:(job:ClaimedJob)=>Promise<unknown>;mark:(job:ClaimedJob)=>Promise<void>;execute:(job:ClaimedJob,mode:WorkerMode)=>Promise<WorkerOutcome>;finish:(state:'succeeded'|'failed'|'reconciling',checkpoint:unknown,errorCode:string|null)=>Promise<void>;heartbeat:()=>Promise<void>}
/** One bounded durable tick. No HTTP request waits for a full customer build. */
export async function processClaimedJob(job:ClaimedJob,deps:WorkerDependencies):Promise<void>{
 if(job.state==='cancel_requested'&&!job.provider_request_id){await deps.finish('failed',null,'cancelled');return}
 let mode:WorkerMode=job.provider_request_id?'reconcile':'dispatch'
 try{await deps.validate(job)}catch(error){
  const denied=error instanceof HostingAccessError||error instanceof CloudError&&['job_actor_revoked','job_exemption_revoked','forbidden','unauthorized'].includes(error.code)
  if(!denied){await deps.finish('reconciling',undefined,'authority_check_unavailable');return}
  if(!job.provider_request_id){await deps.finish('failed',null,'job_actor_revoked');return}
  // Previously dispatched provider work must be observed/cleaned up after revocation.
  mode='cleanup'
 }
 if(job.state==='cancel_requested')mode='cleanup'
 try{
  await deps.heartbeat()
  if(mode==='dispatch')await deps.mark(job)
  const outcome=await deps.execute(job,mode)
  await deps.finish(outcome.state==='pending'?'reconciling':outcome.state,outcome.checkpoint,outcome.errorCode??null)
 }catch(error){
  if(error instanceof CloudError&&['job_lease_lost','stale_job'].includes(error.code))return
  // A mutation timeout or failed checkpoint commit never authorizes another create.
  // Keep the persisted checkpoint; null must not erase provider progress.
  await deps.finish(job.provider_request_id?'reconciling':'failed',undefined,error instanceof CloudError?error.code:'worker_operation_failed')
 }
}
