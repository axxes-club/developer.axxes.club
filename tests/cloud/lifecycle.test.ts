import test from 'node:test'
import assert from 'node:assert/strict'
import * as lifecycle from '../../src/lib/cloud/providers/apps'
import type {AppBinding} from '../../src/lib/cloud/providers/apps'
import type {GcpRequest} from '../../src/lib/cloud/providers/gcp'
const resourceId='11111111-1111-4111-8111-111111111111'
const binding:AppBinding={project:'axxes-customer-hosting',region:'us-west1',service:'cloud-111111111111411181111111',resourceId,tenantId:'22222222-2222-4222-8222-222222222222',runtimeAccount:'runtime-11111111111141118111@axxes-customer-hosting.iam.gserviceaccount.com'}
const digest='us-west1-docker.pkg.dev/axxes-customer-hosting/cloud-111111111111411181111111/app@sha256:'+'a'.repeat(64)
test('staging never changes existing traffic and accepts only the owned digest',async()=>{
 const requests:GcpRequest[]=[]
 const api=async(r:GcpRequest)=>{requests.push(r);return r.method==='GET'?null:{name:'projects/axxes-customer-hosting/locations/us-west1/operations/op',done:false}}
 const result=await lifecycle.stageApp(api,binding,digest,2)
 assert.equal(result.done,false)
 const body=requests[1].body as any
 assert.deepEqual(body.traffic,[])
 assert.equal(body.template.scaling.maxInstanceCount,1)
 assert.equal(body.template.serviceAccount,binding.runtimeAccount)
 assert.equal(body.template.containers[0].image,digest)
 await assert.rejects(lifecycle.stageApp(api,binding,digest.replace('cloud-111111111111411181111111','another-tenant'),2),/image_binding/)
})
test('provider submission is pending until completion and ownership-verified readiness',async()=>{
 assert.equal(lifecycle.operationResult({name:'op',done:false}).state,'pending')
 assert.equal(lifecycle.operationResult({name:'op',done:true,error:{message:'provider-secret',code:13}}).state,'failed')
 assert.equal(JSON.stringify(lifecycle.operationResult({name:'op',done:true,error:{message:'provider-secret',code:13}})).includes('provider-secret'),false)
 assert.throws(()=>lifecycle.readyApp(binding,{name:'projects/axxes-customer-hosting/locations/us-west1/services/foreign',terminalCondition:{state:'CONDITION_SUCCEEDED'}}),/binding/)
})
test('deletion first verifies the immutable resource binding and reports pending operations',async()=>{
 const requests:GcpRequest[]=[]
 const service={name:'projects/axxes-customer-hosting/locations/us-west1/services/'+binding.service,labels:{'axxes-resource':resourceId,'axxes-tenant':binding.tenantId}}
 const api=async(r:GcpRequest)=>{requests.push(r);return r.method==='DELETE'?{name:'op',done:false}:service}
 assert.equal((await lifecycle.deleteApp(api,binding)).done,false)
 assert.equal(requests[0].method,'GET');assert.equal(requests[1].method,'DELETE')
 const foreign=async()=>({...service,labels:{'axxes-resource':resourceId,'axxes-tenant':'foreign'}})
 await assert.rejects(lifecycle.deleteApp(foreign,binding),/binding/)
})
test('publication fails closed without positive revision readiness and exact runtime identity',async()=>{
 const service={name:'projects/axxes-customer-hosting/locations/us-west1/services/'+binding.service,labels:{'axxes-resource':resourceId,'axxes-tenant':binding.tenantId}}
 const revision=binding.service+'-g2'
 for(const invalid of [{conditions:[]},{reconciling:true,conditions:[{type:'Ready',state:'CONDITION_SUCCEEDED'}]},{serviceAccount:'foreign',conditions:[{type:'Ready',state:'CONDITION_SUCCEEDED'}]}]){
  const api=async(r:GcpRequest)=>r.path.includes('/revisions/')?{service:service.name,labels:service.labels,containers:[{image:digest}],serviceAccount:binding.runtimeAccount,...invalid}:service
  await assert.rejects(lifecycle.promoteApp(api,binding,revision,digest),/revision_not_ready/)
 }
})
test('staging an existing app rejects unresolved provider traffic rather than resetting it',async()=>{
 const service={name:'projects/axxes-customer-hosting/locations/us-west1/services/'+binding.service,labels:{'axxes-resource':resourceId,'axxes-tenant':binding.tenantId},reconciling:true}
 await assert.rejects(lifecycle.stageApp(async()=>service,binding,digest,2),/app_not_ready/)
})
test('a verified owned revision receives all traffic and staging preserves existing tagged traffic',async()=>{
 const servicePath='projects/axxes-customer-hosting/locations/us-west1/services/'+binding.service
 const service={name:servicePath,labels:{'axxes-resource':resourceId,'axxes-tenant':binding.tenantId},reconciling:false,terminalCondition:{state:'CONDITION_SUCCEEDED'},trafficStatuses:[{revision:binding.service+'-g1',percent:100,tag:'stable'}]}
 const revision={name:servicePath+'/revisions/'+binding.service+'-g2',service:servicePath,labels:service.labels,containers:[{image:digest}],serviceAccount:binding.runtimeAccount,conditions:[{type:'Ready',state:'CONDITION_SUCCEEDED'}]}
 const mutations:GcpRequest[]=[]
 const api=async(r:GcpRequest)=>{if(r.method==='PATCH'){mutations.push(r);return {name:'op',done:false}};return r.path.includes('/revisions/')?revision:service}
 await lifecycle.stageApp(api,binding,digest,2)
 assert.deepEqual((mutations[0].body as any).traffic,[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:binding.service+'-g1',percent:100,tag:'stable'}])
 await lifecycle.promoteApp(api,binding,binding.service+'-g2',digest)
 assert.deepEqual((mutations[1].body as any).traffic,[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:binding.service+'-g2',percent:100}])
})
