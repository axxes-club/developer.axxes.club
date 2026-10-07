import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from '../deploy/helpers/postgres';import {applyFoundation,applyOwnerPolicy,freeOwnerId,tenantA,tenantB} from '../deploy/helpers/fixtures'
import {createProject,createResource,ownedResource,listProjects} from '../../src/lib/cloud/store';import type {CloudContext} from '../../src/lib/cloud/types'
export const context=(tenantId=tenantA):CloudContext=>({userId:freeOwnerId,user:{name:'Owner',email:'owner@fixture.test'},tenant:{id:tenantId,name:'Fixture',slug:'fixture'},role:'owner',memberships:[],canSwitchOrg:false})
test('owned migration is repeatable; project/resources never cross active tenant boundaries',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await applyOwnerPolicy(pool);const sql=await readFile('db/cloud/001-control-plane.sql','utf8');await pool.query(sql);await pool.query(sql)
 const project=await createProject(context(),{name:'Cloud pilot'},pool)
 assert.equal((await listProjects(context(tenantB),pool)).length,0)
 await assert.rejects(createResource(context(tenantB),{projectId:project.id,name:'Foreign',spec:{kind:'app',runtime:'static',region:'us-west1',cpu:1,memoryMiB:512,minInstances:0,maxInstances:1}},pool),/project_not_found/)
 const resource=await createResource(context(),{projectId:project.id,name:'Own',spec:{kind:'app',runtime:'static',region:'us-west1',cpu:1,memoryMiB:512,minInstances:0,maxInstances:1}},pool)
 await assert.rejects(ownedResource(context(tenantB),resource.id,pool),/resource_not_found/)
 await assert.rejects(pool.query('UPDATE cloud_projects SET tenant_id=$1 WHERE id=$2',[tenantB,project.id]),/immutable/)
}))
