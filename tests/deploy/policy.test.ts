import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resolveHostingPolicy} from '../../src/lib/deploy/policy'
import {requireHostingAccess} from '../../src/lib/deploy/authorization'

const start = new Date('2026-10-01T00:00:00Z')
const end = new Date('2026-11-01T00:00:00Z')
const subject = {tenantId:'a',projectId:'p'}
for (const beneficiary of ['jose','bayamon','otto'] as const) {
  test(`${beneficiary} exemption requires an active explicitly scoped grant`, () => {
    const grant={id:'g',tenantId:'a',projectId:'p',beneficiary,startsAt:start,endsAt:end}
    const result=resolveHostingPolicy(subject,start,[grant])
    assert.deepEqual(result,{exempt:true,grantId:'g',paymentRequired:false,chargeUsage:false,enforceBillingBudget:false})
    assert.equal(resolveHostingPolicy(subject,end,[grant]).exempt,false)
    assert.equal(resolveHostingPolicy({...subject,tenantId:'b'},start,[grant]).exempt,false)
    assert.equal(resolveHostingPolicy({...subject,projectId:'q'},start,[grant]).exempt,false)
    assert.equal(resolveHostingPolicy({...subject,projectId:'q'},start,[{...grant,projectId:null}]).exempt,true)
  })
}
test('names, email and superadmin membership alone confer no hosting exemption', () => {
  assert.deepEqual(resolveHostingPolicy(subject,start,[]),{exempt:false,grantId:null,paymentRequired:true,chargeUsage:true,enforceBillingBudget:true})
})
test('invalid dates and backwards intervals are rejected', () => {
  assert.throws(()=>resolveHostingPolicy(subject,new Date(NaN),[]))
  assert.throws(()=>resolveHostingPolicy(subject,start,[{id:'g',tenantId:'a',projectId:null,beneficiary:'jose',startsAt:end,endsAt:start}]))
})
test('authorization enforces specific hosting roles and fails closed', () => {
  for(const role of ['owner','admin']) for(const operation of ['inspect','usage','billing','deploy'] as const) assert.doesNotThrow(()=>requireHostingAccess({role},operation))
  assert.doesNotThrow(()=>requireHostingAccess({role:'manager'},'deploy'))
  for(const role of ['manager','member','viewer']) assert.throws(()=>requireHostingAccess({role},'inspect'))
  for(const role of ['member','viewer']) {assert.doesNotThrow(()=>requireHostingAccess({role},'usage'));assert.throws(()=>requireHostingAccess({role},'billing'));assert.throws(()=>requireHostingAccess({role},'deploy'))}
  assert.throws(()=>requireHostingAccess({role:'superadmin'},'usage'))
})
