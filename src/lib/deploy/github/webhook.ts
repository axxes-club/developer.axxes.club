import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const MAX_WEBHOOK_BYTES = 1024 * 1024
/** Authenticate raw bytes before JSON parsing. Missing configuration fails closed. */
export function verifyWebhook(body: Buffer, signature: string | null, secret: string): boolean {
  if (secret.length < 32 || body.length > MAX_WEBHOOK_BYTES || !signature || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false
  const expected = createHmac('sha256', secret).update(body).digest()
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))
}
const push = z.object({
  installation: z.object({id:z.number().int().positive().safe()}),
  repository: z.object({id:z.number().int().positive().safe()}),
  ref:z.string().regex(/^refs\/heads\/.+/).max(1024),
  after:z.string().regex(/^[0-9a-f]{40}$/),
  deleted:z.boolean().default(false),
})
/** Repository URLs and payload credentials are never accepted as source authority. */
export function parsePush(body: Buffer) {
  if(body.length>MAX_WEBHOOK_BYTES) throw new Error('Webhook too large')
  const value=push.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body)))
  if(value.deleted) return null
  if(value.after==='0'.repeat(40)) throw new Error('Invalid commit')
  return {installationId:value.installation.id,repositoryId:value.repository.id,branch:value.ref.slice(11),commitSha:value.after}
}
