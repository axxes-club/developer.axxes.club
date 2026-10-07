import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from './helpers/postgres'
import {applyFoundation,tenantA,projectA,tenantB,projectB} from './helpers/fixtures'
import {ingestPush} from '../../src/lib/deploy/github/intake'
const delivery='88888888-8888-4888-8888-888888888888'
const push={installationId:12,repositoryId:34,branch:'main',commitSha:'f'.repeat(40)}
test('source events are atomic, deduplicated, scoped to verified bindings and awaiting budget',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool)
 await pool.query(await readFile('db/deploy/002-source-intake.sql','utf8'))
 await pool.query(`INSERT INTO deploy_source_bindings(tenant_id,project_id,installation_id,repository_id,branch,verified_by) VALUES($1,$2,12,34,'main','admin'),($3,$4,99,34,'main','admin')`,[tenantA,projectA,tenantB,projectB])
 const results=await Promise.all([ingestPush(delivery,'a'.repeat(64),push,pool),ingestPush(delivery,'a'.repeat(64),push,pool)])
 assert.equal(results.filter(x=>x.duplicate).length,1)
 const rows=(await pool.query('SELECT * FROM deploy_build_intents')).rows
 assert.equal(rows.length,1); assert.equal(rows[0].tenant_id,tenantA); assert.equal(rows[0].state,'pending_admission')
 await assert.rejects(ingestPush(delivery,'b'.repeat(64),push,pool),/conflict/i)
 assert.equal((await pool.query('SELECT count(*)::int n FROM deploy_build_intents')).rows[0].n,1)
 await assert.rejects(pool.query("UPDATE deploy_build_intents SET commit_sha=repeat('a',40)"),/immutable/i)
 await assert.rejects(pool.query("UPDATE deploy_webhook_receipts SET payload_hash=repeat('b',64)"),/append-only/i)
 await assert.rejects(pool.query('DELETE FROM deploy_build_intents'),/immutable/i)
 await assert.rejects(pool.query('DELETE FROM deploy_webhook_receipts'),/append-only/i)
 await pool.query("UPDATE deploy_build_intents SET state='rejected'")
 assert.equal((await pool.query('SELECT commit_sha FROM deploy_build_intents')).rows[0].commit_sha,push.commitSha)
}))

import {bindRepository} from '../../src/lib/deploy/github/bind'
test('binding uses authenticated GitHub repository ownership and current tenant project ownership',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await pool.query(await readFile('db/deploy/002-source-intake.sql','utf8'))
 const ctx={tenant:{id:tenantA},role:'owner',userId:'verified-user'}
 const input={projectId:projectA,installationId:12,repositoryId:34,branch:'main'}
 const api=async()=>({repositories:[{id:34,full_name:'customer/site',default_branch:'main'}],total_count:1})
 await bindRepository(ctx,input,'ephemeral-user-token',pool,api)
 assert.equal((await pool.query('SELECT verified_by FROM deploy_source_bindings')).rows[0].verified_by,ctx.userId)
 await assert.rejects(bindRepository(ctx,{...input,projectId:projectB},'token',pool,api),/Project access denied/)
 await assert.rejects(bindRepository(ctx,input,'token',pool,async()=>({repositories:[],total_count:0})),/Repository access denied/)
 await assert.rejects(bindRepository(ctx,{...input,branch:'../main'},'token',pool,api),/Invalid branch/)
 assert.equal((await pool.query('SELECT count(*)::int n FROM deploy_source_bindings')).rows[0].n,1)
}))
