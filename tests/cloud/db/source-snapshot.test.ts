import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from '../../deploy/helpers/postgres'
import {applyFoundation,applyOwnerPolicy,freeOwnerId,tenantA} from '../../deploy/helpers/fixtures'
import {createProject,createResource} from '../../../src/lib/cloud/store'
import {grantOwnerApp,quoteResource,requestOperation} from '../../../src/lib/cloud/admission'
const ctx={userId:freeOwnerId,user:{name:'Owner',email:'owner@fixture.test'},tenant:{id:tenantA,name:'Fixture',slug:'fixture'},role:'owner',memberships:[],canSwitchOrg:false}
test('admitted deployment retains its exact repository and branch after rebinding',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await applyOwnerPolicy(pool)
 await pool.query(await readFile('db/deploy/002-source-intake.sql','utf8'))
 await pool.query(await readFile('db/cloud/001-control-plane.sql','utf8'))
 const project=await createProject(ctx,{name:'Pinned source'},pool)
 const r=await createResource(ctx,{projectId:project.id,name:'App',spec:{kind:'app',runtime:'static',region:'us-west1',cpu:1,memoryMiB:512,minInstances:0,maxInstances:1}},pool)
 await grantOwnerApp(ctx,r.id,pool)
 const backing=(await pool.query('SELECT deploy_project_id FROM cloud_resources WHERE id=$1',[r.id])).rows[0].deploy_project_id
 await pool.query("INSERT INTO deploy_source_bindings(tenant_id,project_id,installation_id,repository_id,branch,verified_by) VALUES($1,$2,123,456,'main',$3)",[tenantA,backing,freeOwnerId])
 await pool.query("INSERT INTO cloud_price_versions(runtime,region,cost_micro_usd,retail_micro_usd,components,verified_by) VALUES('static','us-west1',100,200,'{}','fixture')")
 const saved={...process.env}
 try{
  for(const k of ['CLOUD_GITHUB_CLIENT_ID','CLOUD_GITHUB_CLIENT_SECRET','CLOUD_GITHUB_APP_ID','CLOUD_GITHUB_PRIVATE_KEY','CLOUD_GITHUB_TOKEN_ENCRYPTION_KEY'])process.env[k]='fixture'
  process.env.CLOUD_APP_VERIFIED='true';process.env.CLOUD_OWNER_POLICY_VERIFIED='true'
  const desired={commitSha:'a'.repeat(40)}
  const quote=await quoteResource(ctx,{resourceId:r.id,operation:'deploy',desired},pool)
  const job=await requestOperation(ctx,{resourceId:r.id,operation:'deploy',desired,quoteId:quote.id,idempotencyKey:'pin',expectedGeneration:1},pool)
  await pool.query("UPDATE deploy_source_bindings SET installation_id=999,repository_id=888,branch='replacement' WHERE tenant_id=$1 AND project_id=$2",[tenantA,backing])
  const stored=(await pool.query('SELECT desired FROM cloud_jobs WHERE id=$1',[job.id])).rows[0].desired
  assert.deepEqual(stored.source,{installationId:123,repositoryId:456,branch:'main'})
 }finally{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
}))
