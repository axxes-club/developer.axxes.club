import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,createVerify} from 'node:crypto'
import {appJwt,githubJson} from '../../src/lib/cloud/github/client'

test('GitHub App authentication signs a short-lived RSA token',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048})
  const token=appJwt('123',privateKey.export({format:'pem',type:'pkcs8'}).toString(),1700000000000)
  const [header,body,signature]=token.split('.')
  const claims=JSON.parse(Buffer.from(body,'base64url').toString())
  assert.equal(claims.iss,'123')
  assert.equal(claims.exp-claims.iat,600)
  const verifier=createVerify('RSA-SHA256')
  verifier.update(header+'.'+body)
  assert.equal(verifier.verify(publicKey,signature,'base64url'),true)
})

test('GitHub calls pin the API host and only compare immutable commit identities',async()=>{
  const paths:string[]=[]
  const fetcher:typeof fetch=async input=>{paths.push(String(input));return Response.json({status:'ahead'})}
  const path='/repos/axxes-club/fixture/compare/'+'a'.repeat(40)+'...'+'b'.repeat(40)
  await githubJson(path,'fixture',undefined,fetcher)
  assert.equal(paths[0],'https://api.github.com'+path)
  for(const rejected of ['/repos/axxes-club/fixture/compare/../../admin','https://evil.example','/user/installations?redirect=https://evil.example']){
    await assert.rejects(githubJson(rejected,'fixture',undefined,fetcher),/invalid_github_path/)
  }
  assert.equal(paths.length,1)
})
