import {z} from 'zod'
import {CloudError} from '../types'
import {CUSTOMER_PROJECT,CUSTOMER_REGION,serviceName,type GcpApi} from './gcp'
const uuid=z.uuid()
const bindingSchema=z.object({project:z.literal(CUSTOMER_PROJECT),region:z.literal(CUSTOMER_REGION),service:z.string(),resourceId:uuid,tenantId:uuid,runtimeAccount:z.string()}).strict()
export type AppBinding=z.infer<typeof bindingSchema>
export function appBinding(value:AppBinding){
 const b=bindingSchema.parse(value)
 if(b.service!==serviceName(b.resourceId)||b.runtimeAccount!=='runtime-'+b.resourceId.replaceAll('-','').slice(0,20)+'@'+CUSTOMER_PROJECT+'.iam.gserviceaccount.com')throw new CloudError('invalid_provider_binding')
 return b
}
const path=(b:AppBinding)=>'projects/'+b.project+'/locations/'+b.region+'/services/'+b.service
const labels=(b:AppBinding)=>({'axxes-resource':b.resourceId,'axxes-tenant':b.tenantId})
export function verifyAppOwnership(binding:AppBinding,service:any){const b=appBinding(binding);if(service?.name!==path(b)||service.labels?.['axxes-resource']!==b.resourceId||service.labels?.['axxes-tenant']!==b.tenantId)throw new CloudError('provider_binding_mismatch',409);return service}
function ownedDigest(b:AppBinding,image:string){if(!new RegExp('^us-west1-docker\\.pkg\\.dev/axxes-customer-hosting/'+b.service+'/app@sha256:[a-f0-9]{64}$').test(image))throw new CloudError('image_binding_mismatch')}
export async function stageApp(api:GcpApi,binding:AppBinding,image:string,generation:number){
 const b=appBinding(binding);ownedDigest(b,image);z.number().int().positive().safe().parse(generation)
 const prior=await api({api:'run',path:path(b),method:'GET'});if(prior)verifyAppOwnership(b,prior)
 // A first service is IAM-private; its initial revision cannot receive public requests.
 // Subsequent revisions retain existing traffic by explicitly targeting owned revisions.
 if(prior&&(prior.reconciling===true||prior.terminalCondition?.state!=='CONDITION_SUCCEEDED'||!Array.isArray(prior.trafficStatuses)||!prior.trafficStatuses.length))throw new CloudError('app_not_ready',409)
 const traffic=prior?prior.trafficStatuses.map((t:any)=>{
  if(typeof t.revision!=='string'||!new RegExp('^'+b.service+'-g[1-9][0-9]*$').test(t.revision)||!Number.isInteger(t.percent)||t.percent<0||t.percent>100||t.tag!==undefined&&!/^[a-z][a-z0-9-]{0,62}$/.test(t.tag))throw new CloudError('provider_binding_mismatch')
  return {type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:t.revision,percent:t.percent,...(t.tag?{tag:t.tag}:{})}
 }):[]
 if(prior&&traffic.reduce((sum:number,t:any)=>sum+t.percent,0)!==100)throw new CloudError('app_not_ready',409)
 const body={name:path(b),labels:labels(b),ingress:'INGRESS_TRAFFIC_ALL',template:{revision:b.service+'-g'+generation,labels:{...labels(b),'axxes-generation':String(generation)},serviceAccount:b.runtimeAccount,scaling:{minInstanceCount:0,maxInstanceCount:1},maxInstanceRequestConcurrency:10,timeout:'30s',containers:[{image,ports:[{containerPort:8080}],resources:{limits:{cpu:'1',memory:'512Mi'},cpuIdle:true},startupProbe:{tcpSocket:{port:8080},periodSeconds:5,failureThreshold:24}}]},traffic}
 return api({api:'run',path:prior?path(b)+'?updateMask=template,traffic,labels':'projects/'+b.project+'/locations/'+b.region+'/services?serviceId='+b.service,method:prior?'PATCH':'POST',body})
}
export function operationResult(value:any):{state:'pending'|'failed'|'succeeded';response?:unknown;errorCode?:string}{
 if(!value||typeof value.name!=='string')throw new CloudError('invalid_provider_response',503)
 if(value.done!==true)return {state:'pending'}
 if(value.error)return {state:'failed',errorCode:'provider_operation_failed'}
 return {state:'succeeded',response:value.response}
}
export function readyApp(binding:AppBinding,service:any){verifyAppOwnership(binding,service);if(service.reconciling===true||service.terminalCondition?.state!=='CONDITION_SUCCEEDED'||typeof service.uri!=='string'||!/^https:\/\/[a-z0-9.-]+\.run\.app$/.test(service.uri))throw new CloudError('app_not_ready',409);return {uri:service.uri,revision:service.latestReadyRevision}}
export async function deleteApp(api:GcpApi,binding:AppBinding){const b=appBinding(binding);const service=await api({api:'run',path:path(b),method:'GET'});if(!service)return {name:path(b),done:true,response:{absent:true}};verifyAppOwnership(b,service);return api({api:'run',path:path(b),method:'DELETE'})}
export async function promoteApp(api:GcpApi,binding:AppBinding,revision:string,expectedImage:string){
 const b=appBinding(binding);ownedDigest(b,expectedImage)
 if(!new RegExp('^'+b.service+'-g[1-9][0-9]*$').test(revision))throw new CloudError('revision_binding_mismatch')
 const service=await api({api:'run',path:path(b),method:'GET'});verifyAppOwnership(b,service)
 const owned=await api({api:'run',path:path(b)+'/revisions/'+revision,method:'GET'})
 if(!owned||owned.name!==path(b)+'/revisions/'+revision||owned.service!==path(b)||owned.labels?.['axxes-resource']!==b.resourceId||owned.labels?.['axxes-tenant']!==b.tenantId||owned.reconciling===true||owned.serviceAccount!==b.runtimeAccount||owned.containers?.length!==1||owned.containers[0].image!==expectedImage||!owned.conditions?.some((c:any)=>c.type==='Ready'&&c.state==='CONDITION_SUCCEEDED'))throw new CloudError('revision_not_ready',409)
 return api({api:'run',path:path(b)+'?updateMask=traffic',method:'PATCH',body:{name:path(b),traffic:[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision,percent:100}]}})
}
