import type {Pool,PoolClient} from 'pg'
import {hostingPool} from './postgres'
import {HostingAccessError,requireHostingAccess} from './authorization'
import {loadHostingPolicy} from './exemptions'
import type {HostingSubject} from './types'
export async function assertFreeDeploymentOwner(userId:string|undefined,connection:Pool|PoolClient=hostingPool()){
 if(!userId)throw new HostingAccessError()
 const {rows}=await connection.query('SELECT user_id FROM deploy_free_deployment_owner WHERE singleton=true')
 if(rows.length!==1||rows[0].user_id!==userId)throw new HostingAccessError()
}
/** Caller must supply the real authenticated active membership context. */
export async function authorizeHostingDeployment(ctx:{userId:string;role:string;tenant:{id:string}},subject:HostingSubject,connection:Pool|PoolClient=hostingPool()){
 if(ctx.tenant.id!==subject.tenantId)throw new HostingAccessError()
 const policy=await loadHostingPolicy(subject,new Date(),connection)
 const owner=policy.exempt?(await connection.query('SELECT user_id FROM deploy_free_deployment_owner WHERE singleton=true')).rows[0]?.user_id:null
 requireHostingAccess(ctx,'deploy',{policy,freeOwnerUserId:owner??null})
 return policy
}
