import { createHash } from 'node:crypto'
import { MAX_WEBHOOK_BYTES,parsePush,verifyWebhook } from './webhook'
const reply=(status:number)=>new Response(null,{status,headers:{'cache-control':'no-store'}})
export function createWebhookHandler(secret:()=>string|undefined,ingest:(delivery:string,hash:string,event:ReturnType<typeof parsePush>)=>Promise<unknown>) {
 return async(request:Request)=>{
  const key=secret()
  if(!key || key.length<32) return reply(503)
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json') return reply(415)
  const delivery=request.headers.get('x-github-delivery')
  if(!delivery || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(delivery)) return reply(400)
  if(!request.body) return reply(400)
  const reader=request.body.getReader(); const chunks:Uint8Array[]=[]; let size=0
  try{
   while(true){const {done,value}=await reader.read(); if(done) break; size+=value.byteLength
    if(size>MAX_WEBHOOK_BYTES){await reader.cancel();return reply(413)} chunks.push(value)}
  }catch{return reply(400)}finally{reader.releaseLock()}
  const body=Buffer.concat(chunks)
  if(!verifyWebhook(body,request.headers.get('x-hub-signature-256'),key)) return reply(401)
  if(request.headers.get('x-github-event')!=='push') return reply(204)
  let event:ReturnType<typeof parsePush>
  try{event=parsePush(body)}catch{return reply(400)}
  try{await ingest(delivery.toLowerCase(),createHash('sha256').update(body).digest('hex'),event);return reply(202)}catch{return reply(503)}
 }
}
