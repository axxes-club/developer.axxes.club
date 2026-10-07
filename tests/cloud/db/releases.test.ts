import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from '../../deploy/helpers/postgres'
import {applyFoundation,applyOwnerPolicy,freeOwnerId,tenantA} from '../../deploy/helpers/fixtures'
import {createProject,createResource} from '../../../src/lib/cloud/store'
const ctx={userId:freeOwnerId,user:{name:'Owner',email:'owner@fixture.test'},tenant:{id:tenantA,name:'Fixture',slug:'fixture'},role:'owner',memberships:[],canSwitchOrg:false}
test('a release must reference a job for the same resource and generation',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await applyOwnerPolicy(pool)
 for(const file of ['001-control-plane','002-account-controls','003-release-bindings'])await pool.query(await readFile('db/cloud/'+file+'.sql','utf8'))
 const project=await createProject(ctx,{name:'Release bounds'},pool)
 const make=(name:string)=>createResource(ctx,{projectId:project.id,name,spec:{kind:'app',runtime:'static',region:'us-west1',cpu:1,memoryMiB:512,minInstances:0,maxInstances:1}},pool)
 const a=await make('A'),b=await make('B')
 const job=(await pool.query("INSERT INTO cloud_jobs(tenant_id,resource_id,generation,actor_id,operation,idempotency_key,input_hash,desired,quote) VALUES($1,$2,1,$3,'deploy','release',$4,'{}','{}') RETURNING id",[tenantA,a.id,freeOwnerId,'a'.repeat(64)])).rows[0]
 const insert=(resource:string,generation:number,revision:string)=>pool.query('INSERT INTO cloud_releases(tenant_id,resource_id,job_id,generation,revision,image) VALUES($1,$2,$3,$4,$5,$6)',[tenantA,resource,job.id,generation,revision,'image@sha256:'+ 'a'.repeat(64)])
 await assert.rejects(insert(b.id,1,'foreign'),{code:'23503'})
 await assert.rejects(insert(a.id,2,'wrong-generation'),{code:'23503'})
 await insert(a.id,1,'valid')
 await pool.query(await readFile('db/cloud/003-release-bindings.sql','utf8'))
}))
