import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyWebhook, parsePush } from '../../src/lib/deploy/github/webhook'
const secret='a'.repeat(32)
const body=Buffer.from(JSON.stringify({installation:{id:12},repository:{id:34},ref:'refs/heads/main',after:'f'.repeat(40),deleted:false}))
const signature='sha256='+createHmac('sha256',secret).update(body).digest('hex')
test('webhook authenticates exact bytes and rejects malformed signatures',()=>{
 assert.equal(verifyWebhook(body,signature,secret),true)
 assert.equal(verifyWebhook(Buffer.concat([body,Buffer.from(' ')]),signature,secret),false)
 for(const bad of [null,'sha1=abc','sha256=ff',signature.toUpperCase()]) assert.equal(verifyWebhook(body,bad,secret),false)
 assert.equal(verifyWebhook(body,signature,''),false)
})
test('push pins immutable source identity without carrying secrets or arbitrary URLs',()=>{
 assert.deepEqual(parsePush(body),{installationId:12,repositoryId:34,branch:'main',commitSha:'f'.repeat(40)})
 assert.throws(()=>parsePush(Buffer.from(JSON.stringify({installation:{id:12},repository:{id:34},ref:'refs/heads/main',after:'main'}))))
 assert.equal(parsePush(Buffer.from(JSON.stringify({installation:{id:12},repository:{id:34},ref:'refs/heads/main',after:'0'.repeat(40),deleted:true}))),null)
})

import {createWebhookHandler} from '../../src/lib/deploy/github/http'
test('HTTP webhook authenticates before ingestion, bounds streams and fails closed without configuration',async()=>{
 let calls=0
 const handler=createWebhookHandler(()=>secret,async()=>{calls++})
 const request=(data:Buffer,sig:string=signature)=>new Request('https://axxes.dev/api/deploy/github/webhook',{method:'POST',headers:{'content-type':'application/json','x-github-delivery':'88888888-8888-4888-8888-888888888888','x-github-event':'push','x-hub-signature-256':sig},body:new Uint8Array(data)})
 assert.equal((await handler(request(body,'sha256='+'0'.repeat(64)))).status,401)
 assert.equal(calls,0)
 assert.equal((await handler(request(body))).status,202);assert.equal(calls,1)
 assert.equal((await handler(request(Buffer.alloc(1024*1024+1)))).status,413);assert.equal(calls,1)
 assert.equal((await createWebhookHandler(()=>undefined,async()=>{calls++})(request(body))).status,503)
 const malformed=Buffer.from('{')
 assert.equal((await handler(request(malformed,'sha256='+createHmac('sha256',secret).update(malformed).digest('hex')))).status,400)
 assert.equal(calls,1)
})
