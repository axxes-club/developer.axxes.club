import {z} from 'zod'
import type {Pool} from 'pg'
import {hostingPool,inHostingTransaction} from '../deploy/postgres'
import {platformAccessAllowed} from '../platform-access'
import {createCloudKey,parseCloudKey,checkCloudKeyScope} from './keys'
import {CloudError,type CloudContext} from './types'
import {requireCloudRole} from './authorization'
export async function issueCloudKey(ctx:CloudContext,value:unknown,pool:Pool=hostingPool()){
 requireCloudRole(ctx,'admin')
 const input=z.object({name:z.string().trim().min(1).max(80),scopes:z.array(z.enum(['read','operate'])).min(1).max(2),days:z.number().int().min(1).max(90)}).strict().parse(value)
 const key=createCloudKey(input.scopes)
 return inHostingTransaction(pool,async c=>{
  const row=await c.query("INSERT INTO cloud_api_keys(tenant_id,actor_id,token_hash,name,scopes,expires_at) VALUES($1,$2,$3,$4,$5,statement_timestamp()+($6::int*interval '1 day')) RETURNING id,name,scopes,expires_at",[ctx.tenant.id,ctx.userId,key.hash,input.name,key.scopes,input.days])
  await c.query("INSERT INTO cloud_audit_events(tenant_id,actor_id,kind,payload) VALUES($1,$2,'api_key_issued',$3)",[ctx.tenant.id,ctx.userId,JSON.stringify({keyId:row.rows[0].id,scopes:key.scopes})])
  return {...row.rows[0],token:key.token}
 })
}
export async function listCloudKeys(ctx:CloudContext,pool:Pool=hostingPool()){requireCloudRole(ctx,'admin');return (await pool.query('SELECT id,name,scopes,created_at,expires_at,revoked_at FROM cloud_api_keys WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100',[ctx.tenant.id])).rows}
export async function authenticateCloudKey(token:string,operation:'read'|'operate',pool:Pool=hostingPool()):Promise<CloudContext>{
 const hash=parseCloudKey(token)
 const key=await pool.query("UPDATE cloud_api_keys SET window_requests=CASE WHEN window_started_at<=statement_timestamp()-interval '1 minute' THEN 1 ELSE window_requests+1 END,window_started_at=CASE WHEN window_started_at<=statement_timestamp()-interval '1 minute' THEN statement_timestamp() ELSE window_started_at END WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>statement_timestamp() AND (window_started_at<=statement_timestamp()-interval '1 minute' OR window_requests<120) RETURNING actor_id,tenant_id,scopes",[hash])
 if(key.rowCount!==1)throw new CloudError('api_key_rejected',401)
 const row=key.rows[0];checkCloudKeyScope(row.scopes,operation)
 const user=await pool.query("SELECT u.id,u.name,u.email,t.id tenant_id,t.name tenant_name,t.slug,m.role FROM \"user\" u JOIN tenant_memberships m ON m.user_id=u.id JOIN tenants t ON t.id=m.tenant_id WHERE u.id=$1 AND t.id=$2 AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND t.status NOT IN('suspended','cancelled')",[row.actor_id,row.tenant_id])
 if(user.rowCount!==1||!await platformAccessAllowed(row.actor_id,row.tenant_id))throw new CloudError('api_key_rejected',401)
 const u=user.rows[0];const ctx:CloudContext={userId:u.id,user:{name:u.name,email:u.email},tenant:{id:u.tenant_id,name:u.tenant_name,slug:u.slug},role:u.role,memberships:[],canSwitchOrg:false}
 requireCloudRole(ctx,operation);return ctx
}
export async function revokeCloudKey(ctx:CloudContext,id:string,pool:Pool=hostingPool()){
 requireCloudRole(ctx,'admin');z.uuid().parse(id)
 return inHostingTransaction(pool,async c=>{
  const row=await c.query('UPDATE cloud_api_keys SET revoked_at=COALESCE(revoked_at,statement_timestamp()) WHERE tenant_id=$1 AND id=$2 RETURNING id',[ctx.tenant.id,id]);if(!row.rowCount)throw new CloudError('api_key_not_found',404)
  await c.query("INSERT INTO cloud_audit_events(tenant_id,actor_id,kind,payload) VALUES($1,$2,'api_key_revoked',$3)",[ctx.tenant.id,ctx.userId,JSON.stringify({keyId:id})]);return {revoked:true}
 })
}
