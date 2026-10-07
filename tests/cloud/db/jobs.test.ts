import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from '../../deploy/helpers/postgres'
import {applyFoundation,applyOwnerPolicy,freeOwnerId,tenantA} from '../../deploy/helpers/fixtures'
import {createProject,createResource} from '../../../src/lib/cloud/store'
import {claimJob,cancelJob,completeJob,revalidateJobActor,type ClaimedJob} from '../../../src/lib/cloud/jobs'
import {grantOwnerApp} from '../../../src/lib/cloud/admission'
import {reserveBudget} from '../../../src/lib/deploy/budget'
import type {CloudContext} from '../../../src/lib/cloud/types'

test('parallel workers cannot claim the same job; cancellation and supersession fence success', async () => {
  await withDeployDatabase(async pool => {
    await applyFoundation(pool)
    await applyOwnerPolicy(pool)
    await pool.query(await readFile('db/cloud/001-control-plane.sql','utf8'))
    const ctx:CloudContext={userId:freeOwnerId,user:{name:'Owner',email:'owner@fixture.test'},tenant:{id:tenantA,name:'Fixture',slug:'fixture'},role:'owner',memberships:[],canSwitchOrg:false}
    const project=await createProject(ctx,{name:'Jobs'},pool)
    const resource=await createResource(ctx,{projectId:project.id,name:'App',spec:{kind:'app',runtime:'static',region:'us-west1',cpu:1,memoryMiB:512,minInstances:0,maxInstances:1}},pool)
    async function enqueue(key:string){
      await pool.query("INSERT INTO cloud_jobs(tenant_id,resource_id,generation,actor_id,operation,idempotency_key,input_hash,desired,quote) SELECT $1,id,generation,$3,'deploy',$4,$5,'{}','{}' FROM cloud_resources WHERE tenant_id=$1 AND id=$2",[tenantA,resource.id,freeOwnerId,key,'a'.repeat(64)])
    }
    await enqueue('cancel')
    const claimed=await Promise.all([claimJob(pool),claimJob(pool)])
    assert.equal(claimed.filter(Boolean).length,1)
    const canceled=claimed.find(Boolean)!
    await cancelJob(ctx,canceled.id,pool)
    await assert.rejects(completeJob(canceled,'succeeded',{},null,pool),/job_lease_lost/)
    assert.equal((await pool.query('SELECT state FROM cloud_jobs WHERE id=$1',[canceled.id])).rows[0].state,'cancel_requested')
    await completeJob(canceled,'failed',{},'cancelled',pool)
    await enqueue('superseded')
    const stale=(await claimJob(pool))!
    await pool.query('UPDATE cloud_resources SET generation=generation+1 WHERE tenant_id=$1 AND id=$2',[tenantA,resource.id])
    await assert.rejects(completeJob(stale,'succeeded',{},null,pool),/job_lease_lost/)
    await completeJob(stale,'failed',{},'superseded',pool)
  })
})

test('a queued free job loses spending authority when its exact app grant is revoked',async()=>{
 await withDeployDatabase(async pool=>{
  await applyFoundation(pool)
  await applyOwnerPolicy(pool)
  await pool.query('ALTER TABLE "user" ADD COLUMN name text')
  await pool.query("ALTER TABLE tenants ADD COLUMN name text,ADD COLUMN slug text,ADD COLUMN status text DEFAULT 'active',ADD COLUMN deleted_at timestamptz")
  await pool.query('CREATE TABLE tenant_memberships(user_id text,tenant_id uuid,role text,deleted_at timestamptz)')
  await pool.query("INSERT INTO tenant_memberships VALUES($1,$2,'owner',NULL)",[freeOwnerId,tenantA])
  await pool.query(await readFile('db/cloud/001-control-plane.sql','utf8'))
  const ctx:CloudContext={userId:freeOwnerId,user:{name:'Owner',email:'owner@fixture.test'},tenant:{id:tenantA,name:'Fixture',slug:'fixture'},role:'owner',memberships:[],canSwitchOrg:false}
  const project=await createProject(ctx,{name:'Owner'},pool)
  const resource=await createResource(ctx,{projectId:project.id,name:'Free app',spec:{kind:'app',runtime:'static',region:'us-west1',cpu:1,memoryMiB:512,minInstances:0,maxInstances:1}},pool)
  const grant=await grantOwnerApp(ctx,resource.id,pool)
  const backing=(await pool.query('SELECT deploy_project_id FROM cloud_resources WHERE id=$1',[resource.id])).rows[0].deploy_project_id
  const reservation=await reserveBudget({subject:{tenantId:tenantA,projectId:backing},operationId:'free-job',amountMicroUsd:1000000n,actorUserId:freeOwnerId},pool)
  assert.equal(reservation.status,'exempt')
  const job={tenant_id:tenantA,actor_id:freeOwnerId,reservation_id:reservation.reservationId,quote:{exempt:true,deployProjectId:backing,amountMicroUsd:'1000000'}} as ClaimedJob
  await revalidateJobActor(job,pool)
  await pool.query("INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) VALUES($1,$2,statement_timestamp(),$3,'Stop new free spending')",[grant.grantId,tenantA,freeOwnerId])
  await pool.query('SELECT pg_sleep(0.01)')
  await assert.rejects(revalidateJobActor(job,pool),/job_exemption_revoked/)
 })
})
