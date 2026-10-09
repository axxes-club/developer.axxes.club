import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from '../../deploy/helpers/postgres'
import {applyFoundation,applyOwnerPolicy,applyPlatformIdentity,freeOwnerId,tenantA,tenantB} from '../../deploy/helpers/fixtures'
import {issueCloudKey,authenticateCloudKey,revokeCloudKey} from '../../../src/lib/cloud/key-store'
const ctx={userId:freeOwnerId,user:{name:'Owner',email:'owner@fixture.test'},tenant:{id:tenantA,name:'Fixture',slug:'fixture'},role:'owner',memberships:[],canSwitchOrg:false}
test('keys are tenant-bound, revocable, bounded and rate-limited with live membership',async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool);await applyOwnerPolicy(pool)
 await pool.query('ALTER TABLE "user" ADD COLUMN name text')
 await pool.query("ALTER TABLE tenants ADD COLUMN name text,ADD COLUMN slug text,ADD COLUMN status text DEFAULT 'active',ADD COLUMN deleted_at timestamptz")
 await pool.query('CREATE TABLE tenant_memberships(user_id text,tenant_id uuid,role text,deleted_at timestamptz)')
 await pool.query("INSERT INTO tenant_memberships VALUES($1,$2,'owner',NULL)",[freeOwnerId,tenantA])
 await applyPlatformIdentity(pool)
 for(const file of ['001-control-plane','002-account-controls'])await pool.query(await readFile('db/cloud/'+file+'.sql','utf8'))
 const key=await issueCloudKey(ctx,{name:'Automation',scopes:['read'],days:30},pool)
 const stored=(await pool.query('SELECT * FROM cloud_api_keys')).rows[0]
 assert.ok(!JSON.stringify(stored).includes(key.token))
 const authenticated=await authenticateCloudKey(key.token,'read',pool)
 assert.equal(authenticated.tenant.id,tenantA)
 await assert.rejects(authenticateCloudKey(key.token,'operate',pool),/api_key_scope/)
 await pool.query('UPDATE cloud_api_keys SET window_requests=120 WHERE id=$1',[key.id])
 await assert.rejects(authenticateCloudKey(key.token,'read',pool),/api_key_rejected/)
 await pool.query("UPDATE cloud_api_keys SET window_started_at=statement_timestamp()-interval '2 minutes' WHERE id=$1",[key.id])
 assert.equal((await authenticateCloudKey(key.token,'read',pool)).tenant.id,tenantA)
 await assert.rejects(revokeCloudKey({...ctx,tenant:{...ctx.tenant,id:tenantB}},key.id,pool),/api_key_not_found/)
 await pool.query('UPDATE tenant_memberships SET deleted_at=statement_timestamp() WHERE user_id=$1',[freeOwnerId])
 await assert.rejects(authenticateCloudKey(key.token,'read',pool),/api_key_rejected/)
 await revokeCloudKey(ctx,key.id,pool)
 await assert.rejects(authenticateCloudKey(key.token,'read',pool),/api_key_rejected/)
}))
