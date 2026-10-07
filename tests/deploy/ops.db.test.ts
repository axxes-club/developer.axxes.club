import test from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {randomUUID} from 'node:crypto'
import {withDeployDatabase} from './helpers/postgres'
import {applyFoundation} from './helpers/fixtures'
const run=promisify(execFile)
for(const uppercase of [false,true])test(`exemption retries observe grants created while waiting; canonical UUID=${uppercase}`,async()=>withDeployDatabase(async pool=>{
 await applyFoundation(pool)
 await pool.query("ALTER TABLE tenants ADD COLUMN name text DEFAULT 'Fixture', ADD COLUMN deleted_at timestamptz")
 const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 await pool.query('INSERT INTO tenants(id) VALUES($1)',[tenant])
 const schema=(await pool.query('SELECT current_schema() name')).rows[0].name
 const application='bind-'+randomUUID()
 const url=new URL(process.env.DEPLOY_TEST_DATABASE_URL!)
 url.searchParams.set('options','-c search_path='+schema+',public')
 url.searchParams.set('application_name',application)
 const lock=await pool.connect();let child:ReturnType<typeof run>|undefined;let unlocked=false;let finished=false
 const key='deploy-exemption:'+tenant+':jose'
 try{
  await lock.query('SELECT pg_advisory_lock(hashtext($1))',[key])
  child=run(process.execPath,['scripts/deploy-bind-exemption.mjs','jose',uppercase?tenant.toUpperCase():tenant,'verified-test-operator'],{env:{...process.env,DATABASE_URL:url.toString()}})
  child.then(()=>{finished=true},()=>{finished=true})
  let waiting=false;const deadline=Date.now()+10000
  while(Date.now()<deadline&&!finished){
   waiting=(await pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock') waiting",[application])).rows[0].waiting
   if(waiting)break
   await new Promise(resolve=>setTimeout(resolve,20))
  }
  assert.equal(waiting,true,'binding must wait on the canonical tenant lock')
  await pool.query(`INSERT INTO deploy_exemption_grants(tenant_id,beneficiary,starts_at,issued_by,reason) VALUES($1,'jose',clock_timestamp(),'first-operator','concurrent approved grant')`,[tenant])
  await lock.query('SELECT pg_advisory_unlock(hashtext($1))',[key]);unlocked=true
  const result=JSON.parse(String((await child).stdout))
  assert.equal(result.reused,true,'post-lock statement time must observe the first grant')
  assert.equal((await pool.query('SELECT count(*)::int n FROM deploy_exemption_grants WHERE tenant_id=$1',[tenant])).rows[0].n,1)
 }finally{
  if(!unlocked)await lock.query('SELECT pg_advisory_unlock(hashtext($1))',[key])
  lock.release();await child?.catch(()=>{})
 }
}))
