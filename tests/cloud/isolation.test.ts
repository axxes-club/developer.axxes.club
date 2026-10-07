import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareAppInfrastructure} from '../../src/lib/cloud/providers/isolation'
import type {GcpRequest} from '../../src/lib/cloud/providers/gcp'
const id='11111111-1111-4111-8111-111111111111',tenant='22222222-2222-4222-8222-222222222222'
test('resource infrastructure grants build credentials access only to its own source and artifact stores',async()=>{
 const requests:GcpRequest[]=[]
 const created=new Map<string,any>()
 const api=async(r:GcpRequest)=>{
  requests.push(r)
  if(r.method==='GET')return created.get(r.path)??null
  const body=r.body as any
  if(r.api==='iam'&&r.path.endsWith('/serviceAccounts'))return {email:body.accountId+'@axxes-customer-hosting.iam.gserviceaccount.com',...body.serviceAccount}
  if(r.api==='storage'&&r.path.startsWith('storage/v1/b?'))return {...body,projectNumber:'447016917238'}
  if(r.api==='artifact'&&r.path.includes('?repositoryId=')){const name=r.path.split('?')[0]+'/'+r.path.split('=')[1];created.set(name,{name,...body})}
  return {name:'op',done:true}
 }
 const binding=await prepareAppInfrastructure(api,id,tenant,'cloud-worker@axxes-customer-hosting.iam.gserviceaccount.com')
 assert.equal(binding.service,'cloud-111111111111411181111111')
 const policies=requests.filter(r=>r.path.endsWith(':setIamPolicy')||r.path.endsWith('/iam')&&r.method==='PUT')
 assert.ok(policies.length>=3)
 for(const r of policies){assert.ok(!r.path.includes('projects/gravy-meta'));assert.ok(!JSON.stringify(r.body).includes('roles/editor'));assert.ok(!JSON.stringify(r.body).includes('roles/owner'))}
 const storage=policies.find(r=>r.api==='storage')!
 assert.ok(storage.path.includes('axxes-source-11111111111141118111111111111111'))
 assert.ok(JSON.stringify(storage.body).includes('build-1111111111114111811111@'))
 const creator=(storage.body as any).bindings.find((b:any)=>b.role==='roles/storage.objectCreator')
 assert.ok(creator.condition.expression.includes('/objects/log-'),'build identity may create log objects but cannot replace source archives')
})
test('existing foreign infrastructure is rejected before IAM can be modified',async()=>{
 const requests:GcpRequest[]=[]
 const api=async(r:GcpRequest)=>{requests.push(r);return {name:'foreign',description:'belongs to another tenant'}}
 await assert.rejects(prepareAppInfrastructure(api,id,tenant,'cloud-worker@axxes-customer-hosting.iam.gserviceaccount.com'),/binding/)
 assert.equal(requests.filter(r=>r.method!=='GET').length,0)
})

test('correct ownership labels do not authorize public, retained or broadly writable source storage',async()=>{
 const bucket='axxes-source-'+id.replaceAll('-','')
 const good={name:bucket,projectNumber:'447016917238',labels:{'axxes-resource':id,'axxes-tenant':tenant},iamConfiguration:{uniformBucketLevelAccess:{enabled:true},publicAccessPrevention:'enforced'},softDeletePolicy:{retentionDurationSeconds:'0'},lifecycle:{rule:[{action:{type:'Delete'},condition:{age:1}}]}}
 for(const patch of [{projectNumber:'other'},{iamConfiguration:{uniformBucketLevelAccess:{enabled:false},publicAccessPrevention:'inherited'}},{softDeletePolicy:{retentionDurationSeconds:'604800'}},{lifecycle:{rule:[]}}]){
  let bucketIam=false
  const api=async(r:GcpRequest)=>{if(r.api==='iam'&&r.method==='GET')return {email:r.path.split('/').pop(),description:'AXXES cloud '+tenant+' '+id};if(r.api==='storage'){if(r.path==='storage/v1/b/'+bucket)return {...good,...patch};bucketIam=true}return {bindings:[]}}
  await assert.rejects(prepareAppInfrastructure(api,id,tenant,'cloud-worker@axxes-customer-hosting.iam.gserviceaccount.com'),/infrastructure_security_mismatch/)
  assert.equal(bucketIam,false)
 }
 const member='serviceAccount:build-'+id.replaceAll('-','').slice(0,22)+'@axxes-customer-hosting.iam.gserviceaccount.com'
 const api=async(r:GcpRequest)=>{if(r.api==='iam'&&r.method==='GET')return {email:r.path.split('/').pop(),description:'AXXES cloud '+tenant+' '+id};if(r.api==='storage'&&r.path==='storage/v1/b/'+bucket)return good;if(r.api==='storage')return {bindings:[{role:'roles/storage.objectAdmin',members:[member]}]};return {bindings:[]}}
 await assert.rejects(prepareAppInfrastructure(api,id,tenant,'cloud-worker@axxes-customer-hosting.iam.gserviceaccount.com'),/infrastructure_security_mismatch/)
})
