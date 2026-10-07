import test from 'node:test'
import assert from 'node:assert/strict'
import {CloudError} from '../../src/lib/cloud/types'
import {processClaimedJob} from '../../src/lib/cloud/worker'
const job:any={id:'job',operation:'deploy',provider_request_id:null,state:'running',quote:{exempt:true},desired:{commitSha:'a'.repeat(40)}}
test('a worker dispatches only after actor validation and durable dispatch identity',async()=>{
 const calls:string[]=[]
 await processClaimedJob(job,{validate:async()=>{calls.push('validate')},mark:async()=>{calls.push('mark')},execute:async()=>{calls.push('execute');return {state:'pending',checkpoint:{buildId:'build'}}},finish:async(state)=>{calls.push(state)},heartbeat:async()=>{}})
 assert.deepEqual(calls,['validate','mark','execute','reconciling'])
})
test('an ambiguous dispatched outcome remains reconciling and is never resubmitted',async()=>{
 const calls:string[]=[]
 await processClaimedJob({...job,provider_request_id:'job',state:'reconciling'},{validate:async()=>{},mark:async()=>{throw Error('must not redispatch')},execute:async(_j,mode)=>{calls.push(mode);throw Error('provider_outcome_ambiguous')},finish:async(state)=>{calls.push(state)},heartbeat:async()=>{}})
 assert.deepEqual(calls,['reconcile','reconciling'])
})
test('cancellation before dispatch performs no provider operation',async()=>{
 let dispatch=false;let outcome=''
 await processClaimedJob({...job,state:'cancel_requested'},{validate:async()=>{},mark:async()=>{dispatch=true},execute:async()=>{dispatch=true;return {state:'succeeded'}},finish:async(state)=>{outcome=state},heartbeat:async()=>{}})
 assert.equal(dispatch,false);assert.equal(outcome,'failed')
})
test('revoked actors cannot begin new provider spending',async()=>{
 let dispatch=false;let outcome=''
 await processClaimedJob(job,{validate:async()=>{throw new CloudError('job_actor_revoked',403)},mark:async()=>{dispatch=true},execute:async()=>{dispatch=true;return {state:'succeeded'}},finish:async(state)=>{outcome=state},heartbeat:async()=>{}})
 assert.equal(dispatch,false);assert.equal(outcome,'failed')
})
test('transient authority-check failure preserves dispatched work without selecting cleanup',async()=>{
 let executed=false;let state='',checkpoint:unknown=null
 await processClaimedJob({...job,provider_request_id:'job',state:'reconciling'},{validate:async()=>{throw Error('database unavailable')},mark:async()=>{},execute:async()=>{executed=true;return {state:'succeeded'}},finish:async(s,c)=>{state=s;checkpoint=c},heartbeat:async()=>{}})
 assert.equal(executed,false);assert.equal(state,'reconciling');assert.equal(checkpoint,undefined)
})
test('an omitted adapter checkpoint preserves the last durable provider receipt',async()=>{
 let checkpoint:unknown=null
 await processClaimedJob({...job,provider_request_id:'job',state:'reconciling'},{validate:async()=>{},mark:async()=>{},execute:async()=>({state:'pending'}),finish:async(_s,c)=>{checkpoint=c},heartbeat:async()=>{}})
 assert.equal(checkpoint,undefined)
})
