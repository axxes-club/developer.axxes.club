import {createHash} from 'node:crypto'
import {z} from 'zod';import type {Pool} from 'pg'
import {hostingPool,inHostingTransaction} from '../deploy/postgres'
import {authorizeHostingDeployment,assertFreeDeploymentOwner} from '../deploy/free-owner'
import {reserveBudgetInTransaction} from '../deploy/budget'
import {availableCapabilities,cloudConfiguration} from './capabilities'
import {ownedResource} from './store';import {requireCloudRole} from './authorization'
import {CloudError,type CloudContext,type CloudQuote} from './types'
const operation=z.enum(['deploy','rollback','delete'])
const desired=z.union([z.object({commitSha:z.string().regex(/^[0-9a-f]{40}$/)}).strict(),z.object({revision:z.string().regex(/^cloud-[a-f0-9]{24}-[a-z0-9-]{1,40}$/)}).strict(),z.object({}).strict()])
const quoteInput=z.object({resourceId:z.uuid(),operation,desired}).strict()
function validateDesired(op:string,value:z.infer<typeof desired>){if(op==='deploy'&&!('commitSha' in value)||op==='rollback'&&!('revision' in value)||op==='delete'&&Object.keys(value).length)throw new CloudError('invalid_operation')}
export const operationHash=(resourceId:string,op:string,value:unknown)=>createHash('sha256').update(JSON.stringify([resourceId,op,value])).digest('hex')
export async function quoteResource(ctx:CloudContext,value:unknown,pool:Pool=hostingPool()):Promise<CloudQuote>{
 requireCloudRole(ctx,'operate');const input=quoteInput.parse(value);validateDesired(input.operation,input.desired)
 const r=await ownedResource(ctx,input.resourceId,pool);const rates=await pool.query('SELECT id,retail_micro_usd::text amount FROM cloud_price_versions WHERE runtime=$1 AND region=$2 ORDER BY created_at DESC,id DESC LIMIT 1',[r.spec.runtime,r.spec.region]);if(!rates.rowCount)throw new CloudError('pricing_unavailable',503)
 const hash=operationHash(r.id,input.operation,input.desired);const rate=rates.rows[0];const result=await pool.query("INSERT INTO cloud_quotes(tenant_id,resource_id,generation,actor_id,operation,input_hash,rate_version_id,amount_micro_usd,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,statement_timestamp()+interval '5 minutes') RETURNING id,expires_at",[ctx.tenant.id,r.id,r.generation,ctx.userId,input.operation,hash,rate.id,rate.amount]);return {id:result.rows[0].id,tenantId:ctx.tenant.id,resourceId:r.id,generation:Number(r.generation),amountMicroUsd:rate.amount,rateVersionId:rate.id,expiresAt:result.rows[0].expires_at.toISOString(),inputHash:hash}
}
export async function requestOperation(ctx:CloudContext,value:unknown,pool:Pool=hostingPool()){
 requireCloudRole(ctx,'operate');const input=quoteInput.extend({quoteId:z.uuid(),idempotencyKey:z.string().min(1).max(128),expectedGeneration:z.number().int().positive().safe()}).strict().parse(value);validateDesired(input.operation,input.desired)
 const caps=availableCapabilities(cloudConfiguration());if(!caps.length)throw new CloudError('app_provisioning_unavailable',503)
 return inHostingTransaction(pool,async client=>{
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['cloud-admission',ctx.tenant.id,input.idempotencyKey])]);const r=await ownedResource(ctx,input.resourceId,client,true);const hash=operationHash(r.id,input.operation,input.desired)
  const prior=await client.query('SELECT id,input_hash,actor_id,state FROM cloud_jobs WHERE tenant_id=$1 AND idempotency_key=$2',[ctx.tenant.id,input.idempotencyKey]);if(prior.rowCount){if(prior.rows[0].input_hash!==hash||prior.rows[0].actor_id!==ctx.userId)throw new CloudError('idempotency_conflict',409);return {id:prior.rows[0].id,state:prior.rows[0].state}}
  if(Number(r.generation)!==input.expectedGeneration||['deleting','deleted'].includes(r.state))throw new CloudError('resource_changed',409)
  const quotes=await client.query('SELECT * FROM cloud_quotes WHERE tenant_id=$1 AND id=$2 AND resource_id=$3 AND actor_id=$4 AND generation=$5 AND operation=$6 AND input_hash=$7 AND expires_at>statement_timestamp()',[ctx.tenant.id,input.quoteId,r.id,ctx.userId,r.generation,input.operation,hash]);if(quotes.rowCount!==1)throw new CloudError('quote_expired_or_changed',409)
  const subject={tenantId:ctx.tenant.id,projectId:r.deploy_project_id};const policy=await authorizeHostingDeployment(ctx,subject,client);if(!policy.exempt&&!caps[0].paid)throw new CloudError('paid_provisioning_unavailable',503)
  if(input.operation==='deploy'){const binding=await client.query('SELECT project_id FROM deploy_source_bindings WHERE tenant_id=$1 AND project_id=$2',[ctx.tenant.id,subject.projectId]);if(binding.rowCount!==1)throw new CloudError('repository_not_connected',409)}
  const quote=quotes.rows[0];const reservation=await reserveBudgetInTransaction({subject,operationId:'cloud:'+input.idempotencyKey,amountMicroUsd:BigInt(quote.amount_micro_usd),actorUserId:ctx.userId},client);if(!reservation.reservationId)throw new CloudError('insufficient_funds',402)
  const next=Number(r.generation)+1;await client.query('UPDATE cloud_resources SET generation=$3 WHERE tenant_id=$1 AND id=$2',[ctx.tenant.id,r.id,next])
  const result=await client.query('INSERT INTO cloud_jobs(tenant_id,resource_id,generation,actor_id,operation,idempotency_key,input_hash,desired,quote,reservation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,state',[ctx.tenant.id,r.id,next,ctx.userId,input.operation,input.idempotencyKey,hash,JSON.stringify(input.desired),JSON.stringify({id:quote.id,amountMicroUsd:String(quote.amount_micro_usd),rateVersionId:quote.rate_version_id,deployProjectId:subject.projectId,exempt:policy.exempt}),reservation.reservationId]);await client.query("INSERT INTO cloud_audit_events(tenant_id,actor_id,kind,resource_id,payload) VALUES($1,$2,'operation_requested',$3,$4)",[ctx.tenant.id,ctx.userId,r.id,JSON.stringify({jobId:result.rows[0].id,operation:input.operation,generation:next})]);return result.rows[0]
 })
}
export async function grantOwnerApp(ctx:CloudContext,resourceId:string,pool:Pool=hostingPool()){
 requireCloudRole(ctx,'admin');z.uuid().parse(resourceId);return inHostingTransaction(pool,async client=>{await assertFreeDeploymentOwner(ctx.userId,client);const projects=await client.query("SELECT deploy_project_id FROM cloud_resources WHERE tenant_id=$1 AND id=$2 AND kind='app' FOR UPDATE",[ctx.tenant.id,resourceId]);if(!projects.rowCount)throw new CloudError('resource_not_found',404);const backing=projects.rows[0].deploy_project_id;const prior=await client.query("SELECT id FROM deploy_exemption_grants g LEFT JOIN deploy_exemption_revocations r ON r.grant_id=g.id WHERE g.tenant_id=$1 AND g.project_id=$2 AND g.beneficiary='jose' AND g.starts_at<=statement_timestamp() AND (r.ends_at IS NULL OR r.ends_at>statement_timestamp())",[ctx.tenant.id,backing]);if(prior.rowCount)return {grantId:prior.rows[0].id};const grant=await client.query("INSERT INTO deploy_exemption_grants(tenant_id,project_id,beneficiary,starts_at,issued_by,reason) VALUES($1,$2,'jose',statement_timestamp(),$3,'Verified owner explicitly selected free app deployment for this cloud app') RETURNING id",[ctx.tenant.id,backing,ctx.userId]);return {grantId:grant.rows[0].id}})
}
