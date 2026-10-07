import type { Pool } from 'pg'
import { inHostingTransaction, hostingPool } from '../postgres'
import { z } from 'zod'
const input=z.object({installationId:z.number().int().positive().safe(),repositoryId:z.number().int().positive().safe(),branch:z.string().min(1).max(1013),commitSha:z.string().regex(/^[0-9a-f]{40}$/)})
export async function ingestPush(deliveryId:string,payloadHash:string,event:z.infer<typeof input>|null,pool:Pool=hostingPool()) {
 z.uuid().parse(deliveryId); z.string().regex(/^[0-9a-f]{64}$/).parse(payloadHash)
 if(event) input.parse(event)
 return inHostingTransaction(pool,async client=>{
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['deploy-webhook:'+deliveryId])
  const previous=await client.query('SELECT payload_hash FROM deploy_webhook_receipts WHERE delivery_id=$1',[deliveryId])
  if(previous.rows.length){
   if(previous.rows[0].payload_hash!==payloadHash) throw new Error('Webhook delivery conflict')
   return {duplicate:true}
  }
  await client.query('INSERT INTO deploy_webhook_receipts(delivery_id,payload_hash) VALUES($1,$2)',[deliveryId,payloadHash])
  if(event) await client.query(`INSERT INTO deploy_build_intents(tenant_id,project_id,delivery_id,installation_id,repository_id,commit_sha)
   SELECT tenant_id,project_id,$1,installation_id,repository_id,$5 FROM deploy_source_bindings
   WHERE installation_id=$2 AND repository_id=$3 AND branch=$4`,[deliveryId,event.installationId,event.repositoryId,event.branch,event.commitSha])
  return {duplicate:false}
 })
}
