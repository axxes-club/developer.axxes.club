import test from 'node:test';import assert from 'node:assert/strict'
import {providerPath,createGcpApi,serviceName} from '../../src/lib/cloud/providers/gcp'
test('provider requests cannot target company infrastructure or untrusted endpoints',()=>{
 assert.ok(providerPath({api:'run',path:'projects/axxes-customer-hosting/locations/us-west1/services'}).startsWith('https://run.googleapis.com/'))
 for(const path of ['projects/gravy-meta/locations/us-west1/services','https://evil.example','projects/axxes-customer-hosting/../gravy-meta'])assert.throws(()=>providerPath({api:'run',path}))
 assert.throws(()=>serviceName('caller-chosen-service'))
})
test('ambiguous provider mutations fail without blind retry or leaking credentials',async()=>{
 let requests=0;const api=createGcpApi(async()=>'provider-secret',async()=>{requests++;throw Error('provider-secret')})
 await assert.rejects(api({api:'run',path:'projects/axxes-customer-hosting/locations/us-west1/services',method:'POST',body:{}}),/provider_outcome_ambiguous/);assert.equal(requests,1)
})
