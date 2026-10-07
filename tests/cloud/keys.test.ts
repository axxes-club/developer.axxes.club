import test from 'node:test'
import assert from 'node:assert/strict'
import {createCloudKey,parseCloudKey,checkCloudKeyScope} from '../../src/lib/cloud/keys'
test('Cloud API credentials store only hashes and reject Nexus tokens and invalid scopes',()=>{
 const key=createCloudKey(['read'])
 assert.match(key.token,/^axxes_cloud_[A-Za-z0-9_-]{43}$/)
 assert.equal(key.hash.length,64)
 assert.equal(parseCloudKey(key.token),key.hash)
 assert.throws(()=>parseCloudKey('axxes_personal_'+'a'.repeat(43)))
 assert.throws(()=>checkCloudKeyScope(['read'],'operate'),/api_key_scope/)
 assert.doesNotThrow(()=>checkCloudKeyScope(['read','operate'],'operate'))
 assert.throws(()=>createCloudKey(['admin']))
})
