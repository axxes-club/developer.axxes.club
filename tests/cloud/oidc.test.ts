import test from 'node:test';import assert from 'node:assert/strict'
import {SignJWT} from 'jose';import {verifyIdentity,safeReturnPath,createAuthTransaction,authorizationUrl} from '../../src/lib/cloud/oidc'
const options={issuer:'https://handshake.axxes.club',clientId:'cloud',clientSecret:'test-secret-long-enough-for-hmac-signature',origin:'https://cloud.axxes.app'}
test('OIDC validates issuer, audience, nonce and stable subject; email never substitutes for identity',async()=>{
 const token=(values:Record<string,unknown>)=>new SignJWT({nonce:'expected',...values}).setProtectedHeader({alg:'HS256'}).setIssuer(options.issuer).setAudience('cloud').setSubject('stable-owner').setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(options.clientSecret))
 assert.equal(await verifyIdentity(await token({}),options,'expected'),'stable-owner')
 await assert.rejects(verifyIdentity(await token({nonce:'other'}),options,'expected'))
 await assert.rejects(verifyIdentity(await token({}),{...options,clientId:'forged'},'expected'))
 await assert.rejects(verifyIdentity(await token({}),{...options,clientSecret:'wrong'},'expected'))
})
test('only exact cloud callback/issuer and safe local return paths are permitted',()=>{
 const tx=createAuthTransaction('/cloud/projects');const url=new URL(authorizationUrl(options,tx));assert.equal(url.searchParams.get('redirect_uri'),'https://cloud.axxes.app/api/cloud/auth/callback');assert.equal(url.searchParams.get('code_challenge_method'),'S256')
 for(const value of ['https://evil.example','//evil.example','/\\evil.example','/%2f%2fevil.example'])assert.equal(safeReturnPath(value),'/cloud')
 assert.throws(()=>authorizationUrl({...options,origin:'https://evil.example'},tx))
})
