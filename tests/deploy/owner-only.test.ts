import test from 'node:test'
import assert from 'node:assert/strict'
import {requireHostingAccess} from '../../src/lib/deploy/authorization'
const owner='verified-jose-id'
const free={exempt:true,grantId:'g',paymentRequired:false,chargeUsage:false,enforceBillingBudget:false}
const paid={...free,exempt:false,grantId:null,paymentRequired:true,chargeUsage:true,enforceBillingBudget:true}
test('only bound owner can deploy free, even when coworkers share an exempt organization',()=>{
 const check=requireHostingAccess
 assert.doesNotThrow(()=>check({role:'owner',userId:owner},'deploy',{policy:free,freeOwnerUserId:owner}))
 for(const role of ['owner','admin','manager'])assert.throws(()=>check({role,userId:'another-person'},'deploy',{policy:free,freeOwnerUserId:owner}))
 assert.throws(()=>check({role:'owner',userId:owner},'deploy',{policy:free,freeOwnerUserId:null}))
 assert.throws(()=>check({role:'owner',userId:owner},'deploy'))
 assert.doesNotThrow(()=>check({role:'manager',userId:'paid-customer'},'deploy',{policy:paid,freeOwnerUserId:owner}))
})
