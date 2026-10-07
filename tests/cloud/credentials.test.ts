import test from 'node:test';import assert from 'node:assert/strict'
import {sealCredentials,openCredentials} from '../../src/lib/cloud/github/credentials'
test('stored GitHub credentials are authenticated ciphertext bound to the user and tenant',()=>{
 const key=Buffer.alloc(32,7).toString('base64');const value=sealCredentials({accessToken:'secret-token'},'tenant-a:owner',key)
 assert.ok(!value.includes('secret-token'));assert.equal(openCredentials(value,'tenant-a:owner',key).accessToken,'secret-token')
 assert.throws(()=>openCredentials(value,'tenant-b:owner',key));assert.throws(()=>openCredentials(value,'tenant-a:other',key));assert.throws(()=>openCredentials(value,'tenant-a:owner',Buffer.alloc(32,8).toString('base64')))
})
