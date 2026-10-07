import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from '../../deploy/helpers/postgres'
import {applyFoundation,applyOwnerPolicy,freeOwnerId,tenantA} from '../../deploy/helpers/fixtures'
import {createProject,createResource} from '../../../src/lib/cloud/store'
import {claimJob,withPublicationFence} from '../../../src/lib/cloud/jobs'
import {requestOperation} from '../../../src/lib/cloud/admission'
import type {Pool} from 'pg'
const ctx={userId:freeOwnerId,user:{name:'Owner',email:'owner@fixture.test'},tenant:{id:tenantA,name:'Fixture',slug:'fixture'},role:'owner',memberships:[],canSwitchOrg:false}
async function fixture(pool:Pool){
 await applyFoundation(pool);await applyOwnerPolicy(pool)
 await pool.query('ALTER TABLE "user" ADD COLUMN name text')
 await pool.query("ALTER TABLE tenants ADD COLUMN name text,ADD COLUMN slug text,ADD COLUMN status text DEFAULT 'active',ADD COLUMN deleted_at timestamptz")
 await pool.query('CREATE TABLE tenant_memberships(user_id text,tenant_id uuid,role text,deleted_at timestamptz)')
 await pool.query("INSERT INTO tenant_memberships VALUES($1,$2,'owner',NULL)",[freeOwnerId,tenantA])
 await pool.query(await readFile('db/cloud/001-control-plane.sql','utf8'))
 const p=await createProject(ctx,{name:'Recovery'},pool)
 return createResource(ctx,{projectId:p.id,name:'App',spec:{kind:'app',runtime:'static',region:'us-west1',cpu:1,memoryMiB:512,minInstances:0,maxInstances:1}},pool)
}
test('outstanding provider reconciliation remains claimable after twenty attempts',async()=>withDeployDatabase(async pool=>{
 const r=await fixture(pool)
 await pool.query("INSERT INTO cloud_jobs(tenant_id,resource_id,generation,actor_id,operation,idempotency_key,input_hash,desired,quote,state,attempts,provider_request_id) VALUES($1,$2,1,$3,'deploy','recover',$4,'{}','{}','reconciling',20,'provider-request')",[tenantA,r.id,freeOwnerId,'a'.repeat(64)])
 assert.ok(await claimJob(pool),'ongoing provider work must remain recoverable')
}))
test('a recovered cleanup job is independent of funding and capability setup',async()=>withDeployDatabase(async pool=>{
 const r=await fixture(pool)
 const job=await requestOperation(ctx,{resourceId:r.id,operation:'delete',desired:{},idempotencyKey:'cleanup',expectedGeneration:1},pool)
 assert.equal(job.state,'queued')
 const row=(await pool.query('SELECT * FROM cloud_jobs WHERE id=$1',[job.id])).rows[0]
 assert.equal(row.reservation_id,null)
 assert.equal(row.operation,'delete')
 assert.equal((await pool.query('SELECT count(*) FROM deploy_budget_reservations')).rows[0].count,'0')
}))
