import {AdmissionError} from '../security/admission-core.mjs';
import {ZodError} from 'zod'
import {CloudError,type CloudContext} from './types'
import {CLOUD_ORIGINS} from './origins'
export async function readBytes(stream:ReadableStream<Uint8Array>|null,limit=65536,timeoutMs=10000):Promise<Buffer>{
 if(!stream)throw new CloudError('body_required');const reader=stream.getReader();const chunks:Uint8Array[]=[];let length=0;let timer:ReturnType<typeof setTimeout>|undefined
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(new CloudError('body_timeout',408))},timeoutMs)})
 try{return await Promise.race([(async()=>{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new CloudError('body_too_large',413)}chunks.push(value)}return Buffer.concat(chunks,length)})(),timeout])}finally{clearTimeout(timer);reader.releaseLock()}
}
export async function readJson(request:Request,limit=65536){
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new CloudError('json_required',415)
 const declared=request.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||BigInt(declared)>BigInt(limit)))throw new CloudError('body_too_large',413)
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBytes(request.body,limit)))}catch(error){if(error instanceof CloudError)throw error;throw new CloudError('invalid_json')}
}
export function cloudHandler(resolve:(request:Request)=>Promise<CloudContext|null>,run:(ctx:CloudContext,input:unknown,request:Request)=>Promise<unknown>,admission:(ctx:CloudContext)=>Promise<void>=async ctx=>{const {admitWrite}=await import('../security/admission');await admitWrite(ctx)}){return async(request:Request)=>{
 try{const ctx=await resolve(request);if(!ctx)throw new CloudError('unauthorized',401)
 const mutation=request.method!=='GET';if(mutation){const origin=process.env.CLOUD_ORIGIN??'https://cloud.axxes.app';if(!CLOUD_ORIGINS.includes(origin as typeof CLOUD_ORIGINS[number])||request.headers.get('origin')!==origin)throw new CloudError('same_origin_required',403)}
 const input=mutation?await readJson(request):undefined;
 if(mutation)await admission(ctx);
 const result=await run(ctx,input,request);return Response.json(result,{headers:{'cache-control':'no-store'}})
 }catch(error){const status=error instanceof AdmissionError?error.status:error instanceof CloudError?error.status:error instanceof ZodError?400:503;const code=error instanceof AdmissionError?'admission_unavailable':error instanceof CloudError?error.code:error instanceof ZodError?'invalid_request':'temporarily_unavailable';return Response.json({error:code},{status,headers:{'cache-control':'no-store'}})}
}}
