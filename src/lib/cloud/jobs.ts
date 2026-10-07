import {randomUUID} from 'node:crypto';import type {Pool,PoolClient} from 'pg'
import {hostingPool,inHostingTransaction} from '../deploy/postgres';import {platformAccessAllowed} from '../platform-access';import {assertFreeDeploymentOwner} from '../deploy/free-owner'
import {CloudError,type CloudContext} from './types';import {requireCloudRole} from './authorization'
export type ClaimedJob={id:string;tenant_id:string;resource_id:string;generation:string;actor_id:string;operation:'deploy'|'rollback'|'delete';desired:{commitSha?:string;revision?:string;source?:{installationId:number;repositoryId:number;branch:string}};quote:{amountMicroUsd:string;deployProjectId:string;exempt:boolean};reservation_id:string|null;provider_result?:unknown;lease_token:string;provider_request_id:string|null;state:string}
export async function claimJob(pool:Pool=hostingPool()):Promise<ClaimedJob|null>{return inHostingTransaction(pool,async c=>{
 const selected=await c.query("SELECT id FROM cloud_jobs WHERE state IN('queued','running','reconciling','cancel_requested') AND (lease_until IS NULL OR lease_until<statement_timestamp()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");if(!selected.rowCount)return null
 const result=await c.query("UPDATE cloud_jobs SET state=CASE WHEN state='cancel_requested' THEN 'cancel_requested' WHEN provider_request_id IS NULL THEN 'running' ELSE 'reconciling' END,lease_token=$2,lease_until=statement_timestamp()+interval '60 seconds',attempts=attempts+1,updated_at=statement_timestamp() WHERE id=$1 RETURNING *",[selected.rows[0].id,randomUUID()]);return result.rows[0]
})}
export async function heartbeat(job:ClaimedJob,connection:Pool|PoolClient=hostingPool()){
 const r=await connection.query("UPDATE cloud_jobs SET lease_until=statement_timestamp()+interval '60 seconds',updated_at=statement_timestamp() WHERE tenant_id=$1 AND id=$2 AND lease_token=$3 AND lease_until>statement_timestamp() AND state IN('running','reconciling','cancel_requested') RETURNING id",[job.tenant_id,job.id,job.lease_token]);if(r.rowCount!==1)throw new CloudError('job_lease_lost',409)
}
export async function revalidateJobActor(job:ClaimedJob,connection:Pool|PoolClient=hostingPool()):Promise<CloudContext>{
 const result=await connection.query("SELECT u.id,u.name,u.email,t.name tenant_name,t.slug,m.role FROM \"user\" u JOIN tenant_memberships m ON m.user_id=u.id JOIN tenants t ON t.id=m.tenant_id WHERE u.id=$1 AND t.id=$2 AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND t.status NOT IN('suspended','cancelled')",[job.actor_id,job.tenant_id]);if(result.rowCount!==1||!await platformAccessAllowed(job.actor_id,job.tenant_id))throw new CloudError('job_actor_revoked',403)
 const row=result.rows[0];const ctx:CloudContext={userId:row.id,user:{name:row.name,email:row.email},tenant:{id:job.tenant_id,name:row.tenant_name,slug:row.slug},role:row.role,memberships:[],canSwitchOrg:false};requireCloudRole(ctx,'operate');if(job.operation!=='delete'&&job.quote.exempt){
 await assertFreeDeploymentOwner(ctx.userId,connection)
 const grant=await connection.query("SELECT b.id FROM deploy_budget_reservations b JOIN deploy_exemption_grants g ON g.tenant_id=b.tenant_id AND g.id=b.exemption_grant_id LEFT JOIN deploy_exemption_revocations v ON v.tenant_id=g.tenant_id AND v.grant_id=g.id WHERE b.tenant_id=$1 AND b.project_id=$2 AND b.id=$3 AND b.state='reserved' AND g.project_id=b.project_id AND g.beneficiary='jose' AND g.starts_at<=statement_timestamp() AND (v.ends_at IS NULL OR v.ends_at>statement_timestamp())",[job.tenant_id,job.quote.deployProjectId,job.reservation_id])
 if(grant.rowCount!==1)throw new CloudError('job_exemption_revoked',403)
 };return ctx
}
export async function markDispatch(job:ClaimedJob,connection:Pool|PoolClient=hostingPool()){
 const result=await connection.query("UPDATE cloud_jobs SET provider_request_id=id::text,updated_at=statement_timestamp() WHERE tenant_id=$1 AND id=$2 AND lease_token=$3 AND lease_until>statement_timestamp() AND provider_request_id IS NULL AND state='running' RETURNING provider_request_id",[job.tenant_id,job.id,job.lease_token]);if(result.rowCount!==1)throw new CloudError('job_lease_lost',409);job.provider_request_id=result.rows[0].provider_request_id
}
/** Hold resource/job row locks across the bounded promotion request; admission
 * cannot advance the generation while an earlier generation changes traffic. */
export async function withPublicationFence<T>(job:ClaimedJob,run:(c:PoolClient)=>Promise<T>,pool:Pool=hostingPool()){
 return inHostingTransaction(pool,async c=>{await c.query('SELECT id FROM cloud_resources WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[job.tenant_id,job.resource_id]);await revalidateJobActor(job,c);const result=await c.query("SELECT j.id FROM cloud_jobs j JOIN cloud_resources r ON r.tenant_id=j.tenant_id AND r.id=j.resource_id WHERE j.tenant_id=$1 AND j.id=$2 AND j.lease_token=$3 AND j.lease_until>statement_timestamp() AND j.state IN('running','reconciling') AND r.generation=j.generation AND r.state NOT IN('deleted','deleting') FOR UPDATE OF j,r",[job.tenant_id,job.id,job.lease_token]);if(result.rowCount!==1)throw new CloudError('stale_job',409);return run(c)})
}
export async function completeJob(job:ClaimedJob,state:'succeeded'|'failed'|'reconciling',result:unknown,errorCode:string|null=null,pool:Pool=hostingPool()){
 return inHostingTransaction(pool,async connection=>{
 await connection.query('SELECT id FROM cloud_resources WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[job.tenant_id,job.resource_id])
 const row=await connection.query("UPDATE cloud_jobs j SET state=CASE WHEN j.state='cancel_requested' AND $4='reconciling' THEN 'cancel_requested' ELSE $4 END,provider_result=CASE WHEN $7 THEN $5::jsonb ELSE provider_result END,error_code=$6,lease_until=CASE WHEN $4='reconciling' THEN statement_timestamp()+interval '60 seconds' ELSE NULL END,lease_token=NULL,updated_at=statement_timestamp() WHERE j.tenant_id=$1 AND j.id=$2 AND j.lease_token=$3 AND j.lease_until>statement_timestamp() AND ($4<>'succeeded' OR (j.state IN('running','reconciling') AND EXISTS(SELECT 1 FROM cloud_resources r WHERE r.tenant_id=j.tenant_id AND r.id=j.resource_id AND r.generation=j.generation))) AND (j.state<>'cancel_requested' OR $4 IN('failed','reconciling')) RETURNING j.id",[job.tenant_id,job.id,job.lease_token,state,result===undefined?null:JSON.stringify(result),errorCode,result!==undefined]);if(row.rowCount!==1)throw new CloudError('job_lease_lost',409)
 })
}
export async function cancelJob(ctx:CloudContext,id:string,connection:Pool|PoolClient=hostingPool()){
 requireCloudRole(ctx,'operate');const row=await connection.query("UPDATE cloud_jobs SET state='cancel_requested',updated_at=statement_timestamp() WHERE tenant_id=$1 AND id=$2 AND state IN('queued','running','reconciling') RETURNING id,state",[ctx.tenant.id,id]);if(!row.rowCount)throw new CloudError('job_not_cancelable',409);return row.rows[0]
}
