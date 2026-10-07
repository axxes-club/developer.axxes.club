import type {Pool,PoolClient} from 'pg'
import {z} from 'zod'
import {hostingPool,inHostingTransaction} from '../deploy/postgres'
import {CloudError,type CloudContext} from './types'
import {requireCloudRole} from './authorization'
import {resourceSpec} from './capabilities'
const name=z.string().trim().min(1).max(80)
export async function createProject(ctx:CloudContext,value:unknown,pool:Pool=hostingPool()){
 requireCloudRole(ctx,'admin');const input=z.object({name}).strict().parse(value)
 return inHostingTransaction(pool,async client=>{
  const backing=await client.query('INSERT INTO deploy_projects(tenant_id,name) VALUES($1,$2) RETURNING id',[ctx.tenant.id,input.name])
  const result=await client.query('INSERT INTO cloud_projects(tenant_id,name,deploy_project_id,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,created_at',[ctx.tenant.id,input.name,backing.rows[0].id,ctx.userId]);return result.rows[0]
 })
}
export async function listProjects(ctx:CloudContext,connection:Pool|PoolClient=hostingPool()){
 requireCloudRole(ctx,'read');return (await connection.query('SELECT id,name,created_at FROM cloud_projects WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100',[ctx.tenant.id])).rows
}
export async function ownedResource(ctx:CloudContext,id:string,connection:Pool|PoolClient=hostingPool(),lock=false){
 requireCloudRole(ctx,'read');z.uuid().parse(id)
 const result=await connection.query('SELECT r.* FROM cloud_resources r JOIN cloud_projects p ON p.tenant_id=r.tenant_id AND p.id=r.project_id WHERE r.tenant_id=$1 AND r.id=$2'+(lock?' FOR UPDATE OF r':''),[ctx.tenant.id,id]);if(!result.rowCount)throw new CloudError('resource_not_found',404);return result.rows[0]
}
export async function createResource(ctx:CloudContext,value:unknown,pool:Pool=hostingPool()){
 requireCloudRole(ctx,'operate');const input=z.object({projectId:z.uuid(),name,spec:resourceSpec}).strict().parse(value)
 return inHostingTransaction(pool,async c=>{
 const project=await c.query('SELECT id FROM cloud_projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[ctx.tenant.id,input.projectId]);if(!project.rowCount)throw new CloudError('project_not_found',404)
 const backing=await c.query('INSERT INTO deploy_projects(tenant_id,name) VALUES($1,$2) RETURNING id',[ctx.tenant.id,input.name]);const result=await c.query("INSERT INTO cloud_resources(tenant_id,project_id,deploy_project_id,kind,name,spec) VALUES($1,$2,$3,'app',$4,$5) RETURNING id,name,state,generation",[ctx.tenant.id,input.projectId,backing.rows[0].id,input.name,JSON.stringify(input.spec)]);return result.rows[0]
 })
}
export async function listResources(ctx:CloudContext,connection:Pool|PoolClient=hostingPool()){
 requireCloudRole(ctx,'read');return (await connection.query('SELECT id,project_id,kind,name,spec,generation,state,created_at FROM cloud_resources WHERE tenant_id=$1 AND state<>\'deleted\' ORDER BY created_at DESC LIMIT 100',[ctx.tenant.id])).rows
}
export async function listJobs(ctx:CloudContext,connection:Pool|PoolClient=hostingPool()){
 requireCloudRole(ctx,'read');return (await connection.query('SELECT id,resource_id,operation,state,error_code,created_at,updated_at FROM cloud_jobs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100',[ctx.tenant.id])).rows
}

export async function inventoryCounts(ctx:CloudContext,connection:Pool|PoolClient=hostingPool()){
 requireCloudRole(ctx,'read');const result=await connection.query("SELECT (SELECT count(*)::text FROM cloud_projects WHERE tenant_id=$1) projects,(SELECT count(*)::text FROM cloud_resources WHERE tenant_id=$1 AND state<>'deleted') resources,(SELECT count(*)::text FROM cloud_jobs WHERE tenant_id=$1 AND state IN ('queued','running','reconciling','cancel_requested')) active_jobs",[ctx.tenant.id]);return result.rows[0] as {projects:string;resources:string;active_jobs:string}
}
