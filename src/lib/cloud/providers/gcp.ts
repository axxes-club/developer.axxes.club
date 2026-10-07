import {CloudError} from '../types';import {readBytes} from '../http'
export const CUSTOMER_PROJECT='axxes-customer-hosting';export const CUSTOMER_REGION='us-west1'
export type GcpRequest={api:'run'|'build'|'storage'|'artifact'|'iam'|'logs';path:string;method?:'GET'|'POST'|'PATCH'|'DELETE'|'PUT';body?:unknown;bytes?:Uint8Array;contentType?:string}
const roots={run:'https://run.googleapis.com/v2/',build:'https://cloudbuild.googleapis.com/v1/',storage:'https://storage.googleapis.com/',artifact:'https://artifactregistry.googleapis.com/v1/',iam:'https://iam.googleapis.com/v1/',logs:'https://logging.googleapis.com/v2/'}
export function serviceName(resourceId:string){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(resourceId))throw new CloudError('invalid_provider_binding');return 'cloud-'+resourceId.replaceAll('-','').slice(0,24)}
export function providerPath(input:GcpRequest){
 const {api,path}=input;if(path.includes('..')||path.includes('\\')||path.includes('#')||path.startsWith('/')||/%(?:2e|2f|5c)/i.test(path)||/[\u0000-\u0020]/.test(path))throw new CloudError('invalid_provider_path')
 if(api==='storage'){if(!/^(?:storage\/v1\/b(?:\?project=axxes-customer-hosting|\/axxes-source-[a-f0-9]{32}(?:\/.*)?|$)|upload\/storage\/v1\/b\/axxes-source-[a-f0-9]{32}\/o\?)/.test(path))throw new CloudError('invalid_provider_path')}
 else if(api==='logs'){if(path!=='entries:list')throw new CloudError('invalid_provider_path')}
 else if(!path.startsWith('projects/'+CUSTOMER_PROJECT+'/')&&!path.startsWith('projects/'+CUSTOMER_PROJECT+':'))throw new CloudError('invalid_provider_project')
 const url=new URL(roots[api]+path);if(['projectId','project'].some(key=>url.searchParams.getAll(key).some(value=>value!==CUSTOMER_PROJECT)))throw new CloudError('invalid_provider_project');return url.href
}
export function createGcpApi(accessToken:()=>Promise<string>,fetcher:typeof fetch=fetch){return async(input:GcpRequest)=>{
 const url=providerPath(input);const token=await accessToken();if(!token||/[\r\n]/.test(token))throw new CloudError('provider_auth_unavailable',503)
 let res:Response;try{res=await fetcher(url,{method:input.method??'GET',headers:{authorization:'Bearer '+token,'content-type':input.contentType??'application/json'},body:input.bytes?new Uint8Array(input.bytes) as BodyInit:input.body===undefined?undefined:JSON.stringify(input.body),redirect:'error',signal:AbortSignal.timeout(20000),cache:'no-store'})}catch{throw new CloudError('provider_outcome_ambiguous',503)}
 if(res.status===404)return null;if(!res.ok)throw new CloudError(res.status===409?'provider_conflict':'provider_request_failed',503)
 if(res.status===204||!res.body)return {};const bytes=await readBytes(res.body,2*1024*1024,20000);if(!bytes.length)return {};try{return JSON.parse(bytes.toString('utf8'))}catch{throw new CloudError('invalid_provider_response',503)}
}}
let cached:{token:string;expires:number}|undefined
export async function metadataAccessToken(fetcher:typeof fetch=fetch){if(cached&&cached.expires>Date.now()+60000)return cached.token
 const res=await fetcher('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},redirect:'error',signal:AbortSignal.timeout(5000)});if(!res.ok||res.headers.get('metadata-flavor')!=='Google')throw new CloudError('provider_auth_unavailable',503);const value=JSON.parse((await readBytes(res.body,16384,5000)).toString('utf8'));if(typeof value.access_token!=='string'||!Number.isSafeInteger(value.expires_in)||value.expires_in<1)throw new CloudError('provider_auth_unavailable',503);cached={token:value.access_token,expires:Date.now()+Math.min(value.expires_in,3600)*1000};return cached.token
}
export type GcpApi=ReturnType<typeof createGcpApi>
