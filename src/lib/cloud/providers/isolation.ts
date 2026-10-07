import {z} from 'zod'
import {CloudError} from '../types'
import {CUSTOMER_PROJECT,CUSTOMER_REGION,serviceName,type GcpApi} from './gcp'
import type {AppBinding} from './apps'
type Policy={version?:number;etag?:string;bindings?:{role:string;members:string[];condition?:unknown}[]}
function grant(policy:Policy|null,role:string,member:string):Policy{const p=policy??{version:3,bindings:[]};const bindings=(p.bindings??[]).map(b=>({...b,members:[...b.members]}));const row=bindings.find(b=>b.role===role&&!b.condition);if(row){if(!row.members.includes(member))row.members.push(member)}else bindings.push({role,members:[member]});return {...p,bindings}}
export async function prepareAppInfrastructure(api:GcpApi,resourceId:string,tenantId:string,workerAccount:string):Promise<AppBinding>{
 z.uuid().parse(resourceId);z.uuid().parse(tenantId);z.string().regex(/^cloud-worker@axxes-customer-hosting\.iam\.gserviceaccount\.com$/).parse(workerAccount)
 const compact=resourceId.replaceAll('-',''),service=serviceName(resourceId),bucket='axxes-source-'+compact,marker='AXXES cloud '+tenantId+' '+resourceId
 const runtimeId='runtime-'+compact.slice(0,20),buildId='build-'+compact.slice(0,22),email=(id:string)=>id+'@'+CUSTOMER_PROJECT+'.iam.gserviceaccount.com'
 for(const id of [runtimeId,buildId]){
  const accountPath='projects/'+CUSTOMER_PROJECT+'/serviceAccounts/'+email(id)
  let account=await api({api:'iam',path:accountPath,method:'GET'})
  if(!account)account=await api({api:'iam',path:'projects/'+CUSTOMER_PROJECT+'/serviceAccounts',method:'POST',body:{accountId:id,serviceAccount:{displayName:id,description:marker}}})
  if(account?.email!==email(id)||account?.description!==marker)throw new CloudError('provider_binding_mismatch',409)
  const current=await api({api:'iam',path:accountPath+':getIamPolicy',method:'POST',body:{}})
  await api({api:'iam',path:accountPath+':setIamPolicy',method:'POST',body:{policy:grant(current,'roles/iam.serviceAccountUser','serviceAccount:'+workerAccount)}})
 }
 let stored=await api({api:'storage',path:'storage/v1/b/'+bucket,method:'GET'})
 if(!stored)stored=await api({api:'storage',path:'storage/v1/b?project='+CUSTOMER_PROJECT,method:'POST',body:{name:bucket,location:CUSTOMER_REGION,labels:{'axxes-resource':resourceId,'axxes-tenant':tenantId},iamConfiguration:{uniformBucketLevelAccess:{enabled:true},publicAccessPrevention:'enforced'},softDeletePolicy:{retentionDurationSeconds:'0'},lifecycle:{rule:[{action:{type:'Delete'},condition:{age:1}}]}}})
 if(stored?.name!==bucket||stored?.labels?.['axxes-resource']!==resourceId||stored?.labels?.['axxes-tenant']!==tenantId)throw new CloudError('provider_binding_mismatch',409)
 const policy=await api({api:'storage',path:'storage/v1/b/'+bucket+'/iam?optionsRequestedPolicyVersion=3',method:'GET'})
 const member='serviceAccount:'+email(buildId)
 const restricted=grant(policy,'roles/storage.objectViewer',member)
 restricted.version=3
 restricted.bindings=(restricted.bindings??[]).map(row=>row.role==='roles/storage.objectCreator'?{...row,members:row.members.filter(m=>m!==member)}:row).filter(row=>row.members.length)
 restricted.bindings.push({role:'roles/storage.objectCreator',members:[member],condition:{title:'build-log-output-only',expression:"resource.name.startsWith('projects/_/buckets/"+bucket+"/objects/log-')"}})
 await api({api:'storage',path:'storage/v1/b/'+bucket+'/iam',method:'PUT',body:restricted})

 const repoPath='projects/'+CUSTOMER_PROJECT+'/locations/'+CUSTOMER_REGION+'/repositories/'+service
 let repo=await api({api:'artifact',path:repoPath,method:'GET'})
 if(!repo){await api({api:'artifact',path:'projects/'+CUSTOMER_PROJECT+'/locations/'+CUSTOMER_REGION+'/repositories?repositoryId='+service,method:'POST',body:{format:'DOCKER',labels:{'axxes-resource':resourceId,'axxes-tenant':tenantId},description:marker}});repo=await api({api:'artifact',path:repoPath,method:'GET'})}
 if(!repo)throw new CloudError('infrastructure_pending',503)
 if(repo.name!==repoPath||repo.labels?.['axxes-resource']!==resourceId||repo.labels?.['axxes-tenant']!==tenantId)throw new CloudError('provider_binding_mismatch',409)
 const repoPolicy=await api({api:'artifact',path:repoPath+':getIamPolicy',method:'GET'})
 await api({api:'artifact',path:repoPath+':setIamPolicy',method:'POST',body:{policy:grant(repoPolicy,'roles/artifactregistry.writer',member)}})
 return {project:CUSTOMER_PROJECT,region:CUSTOMER_REGION,resourceId,tenantId,service,runtimeAccount:email(runtimeId)}
}
