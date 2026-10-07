import test from 'node:test';import assert from 'node:assert/strict'
import {cloudHandler} from '../../src/lib/cloud/http';import type {CloudContext} from '../../src/lib/cloud/types'
const ctx={userId:'owner',tenant:{id:'tenant'},role:'owner'} as CloudContext
const request=(body='{}',origin='https://cloud.axxes.app')=>new Request('https://cloud.axxes.app/api/cloud/projects',{method:'POST',headers:{origin,'content-type':'application/json'},body})
test('cloud API authenticates before work and rejects cross-origin and oversized input',async()=>{
 let calls=0;const run=async()=>{calls++;return {ok:true}}
 assert.equal((await cloudHandler(async()=>null,run)(request())).status,401)
 assert.equal((await cloudHandler(async()=>ctx,run)(request('{}','https://evil.example'))).status,403)
 assert.equal((await cloudHandler(async()=>ctx,run)(request(JSON.stringify({value:'x'.repeat(70000)})))).status,413)
 assert.equal(calls,0)
 assert.equal((await cloudHandler(async()=>ctx,run)(request())).status,200);assert.equal(calls,1)
})
test('provider exceptions do not expose secrets or internal details',async()=>{
 const response=await cloudHandler(async()=>ctx,async()=>{throw Error('secret-token-value')})(request());assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret-token-value'))
})
