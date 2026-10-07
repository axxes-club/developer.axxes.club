import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import {hostingPool} from '../deploy/postgres'
import {platformAccessAllowed} from '../platform-access'
import {SESSION_COOKIE} from './session'
import {hashToken} from './oidc'
import type {CloudContext} from './types'
export async function getCloudContext():Promise<CloudContext|null>{
 const jar=await cookies();const token=jar.get(SESSION_COOKIE)?.value;if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null
 const pool=hostingPool();const users=await pool.query('SELECT u.id,u.name,u.email FROM cloud_sessions s JOIN "user" u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>statement_timestamp()',[hashToken(token)]);if(users.rowCount!==1)return null
 const user=users.rows[0];if(!await platformAccessAllowed(user.id))return null
 const result=await pool.query("SELECT t.id,t.name,t.slug,m.role,m.is_primary FROM tenant_memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=$1 AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND t.status NOT IN('suspended','cancelled') ORDER BY m.is_primary DESC,t.name",[user.id]);const memberships=[]
 for(const row of result.rows)if(await platformAccessAllowed(user.id,row.id))memberships.push({tenantId:row.id,name:row.name,slug:row.slug,role:row.role,isPrimary:row.is_primary===true})
 const selected=jar.get('axxes_cloud_org')?.value;const chosen=memberships.find(m=>m.tenantId===selected)??memberships.find(m=>m.isPrimary)??memberships[0];if(!chosen)return null
 return {userId:user.id,user:{name:user.name,email:user.email},tenant:{id:chosen.tenantId,name:chosen.name,slug:chosen.slug},role:chosen.role,memberships,canSwitchOrg:memberships.length>1}
}
export async function requireCloudContext(){const ctx=await getCloudContext();if(!ctx)redirect('/cloud/sign-in');return ctx}
