import test from 'node:test'
import assert from 'node:assert/strict'
import {resourceSpec,availableCapabilities} from '../../src/lib/cloud/capabilities'
test('only the verified pilot app shape is accepted; extra authority fields and unsupported kinds fail',()=>{
 const spec={kind:'app',runtime:'next-standalone',region:'us-west1',cpu:1,memoryMiB:512,minInstances:0,maxInstances:1}
 assert.equal(resourceSpec.parse(spec).kind,'app')
 for(const change of [{kind:'server'},{region:'us-east1'},{maxInstances:2},{tenantId:'forged'},{exempt:true},{providerProject:'gravy-meta'}])assert.throws(()=>resourceSpec.parse({...spec,...change}))
})
test('capabilities stay hidden until verified setup; paid launch requires payment, metering and cost verification',()=>{
 assert.deepEqual(availableCapabilities({}),[])
 const owner={appAdapterVerified:true,githubConfigured:true,ownerPolicyVerified:true}
 assert.deepEqual(availableCapabilities(owner).map(c=>c.key),['apps'])
 assert.equal(availableCapabilities(owner)[0].paid,false)
 assert.equal(availableCapabilities({...owner,paymentVerified:true,meteringVerified:true,pricingVerified:true})[0].paid,true)
 assert.deepEqual(availableCapabilities({...owner,githubConfigured:false}),[])
})
