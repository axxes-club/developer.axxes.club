import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from './helpers/postgres'
import {applyFoundation,applyOwnerPolicy,freeOwnerId,grant,subjectA,tenantA,projectA,tenantB,projectB} from './helpers/fixtures'
import {reserveBudget} from '../../src/lib/deploy/budget'
import {authorizeHostingDeployment} from '../../src/lib/deploy/free-owner'
import {loadHostingPolicy} from '../../src/lib/deploy/exemptions'
import {ingestPush} from '../../src/lib/deploy/github/intake'
test('new policy revokes non-owner grants prospectively, blocks reissuing and preserves history',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await grant(pool,'bayamon');await applyOwnerPolicy(pool)
 assert.equal((await loadHostingPolicy(subjectA,new Date('2026-10-02'),pool)).exempt,true)
 assert.equal((await loadHostingPolicy(subjectA,new Date(Date.now()+1000),pool)).exempt,false)
 await assert.rejects(pool.query(`INSERT INTO deploy_exemption_grants(tenant_id,project_id,beneficiary,starts_at,issued_by,reason) VALUES($1,$2,'otto',now(),'admin','new grant')`,[tenantA,projectA]),/Only the verified owner/i)
 await assert.rejects(pool.query('UPDATE deploy_free_deployment_owner SET user_id=$1',['someone-else']),/append-only/i)
 await assert.rejects(pool.query('DELETE FROM deploy_free_deployment_owner'),/append-only/i)
}))
test('other members cannot reserve or replay free operations; paid customers still reserve normally',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await grant(pool);await applyOwnerPolicy(pool)
 const input={subject:subjectA,operationId:'exclusive',amountMicroUsd:1000n}
 await assert.rejects(reserveBudget(input,pool),/access denied/i)
 await assert.rejects(reserveBudget({...input,actorUserId:'another-person'},pool),/access denied/i)
 const result=await reserveBudget({...input,actorUserId:freeOwnerId},pool);assert.equal(result.status,'exempt')
 await assert.rejects(reserveBudget({...input,actorUserId:'another-person'},pool),/access denied/i)
 await assert.rejects(authorizeHostingDeployment({role:'owner',userId:'another-person',tenant:{id:tenantA}},subjectA,pool),/access denied/i)
 assert.equal((await authorizeHostingDeployment({role:'owner',userId:freeOwnerId,tenant:{id:tenantA}},subjectA,pool)).exempt,true)
 await pool.query('INSERT INTO deploy_billing_accounts(tenant_id,available_micro_usd) VALUES($1,1000)',[tenantB])
 assert.equal((await reserveBudget({subject:{tenantId:tenantB,projectId:projectB},operationId:'paid',amountMicroUsd:1000n,actorUserId:'paid-customer'},pool)).status,'reserved')
}))
test('automated pushes cannot launch free builds without verified owner actor identity',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await grant(pool);await applyOwnerPolicy(pool)
 await pool.query(await readFile('db/deploy/002-source-intake.sql','utf8'))
 await pool.query(`INSERT INTO deploy_source_bindings(tenant_id,project_id,installation_id,repository_id,branch,verified_by) VALUES($1,$2,12,34,'main','owner')`,[tenantA,projectA])
 await ingestPush('88888888-8888-4888-8888-888888888888','a'.repeat(64),{installationId:12,repositoryId:34,branch:'main',commitSha:'f'.repeat(40)},pool)
 assert.equal((await pool.query('SELECT count(*)::int n FROM deploy_build_intents')).rows[0].n,0)
}))

test('migration refuses an existing future non-owner revocation instead of leaving free access active',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await grant(pool,'bayamon')
 await pool.query(`INSERT INTO deploy_exemption_revocations(grant_id,tenant_id,ends_at,issued_by,reason) SELECT id,tenant_id,now()+interval '1 month','admin','scheduled' FROM deploy_exemption_grants`)
 await assert.rejects(applyOwnerPolicy(pool),/Scheduled non-owner revocation requires explicit policy cutoff/i)
}))
