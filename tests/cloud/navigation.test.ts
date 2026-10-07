import test from 'node:test'
import assert from 'node:assert/strict'
import {access} from 'node:fs/promises'
import {cloudNavigation} from '../../src/lib/cloud/navigation'

test('every advertised Cloud navigation destination has a protected page', async () => {
  for(const item of cloudNavigation([{key:'apps',name:'Apps',paid:false}])){
    const suffix=item.href.slice('/cloud'.length)
    await access(`src/app/cloud/(console)${suffix}/page.tsx`)
  }
  await access('src/app/cloud/(console)/layout.tsx')
  await access('src/app/cloud/sign-in/page.tsx')
})

test('unverified provisioning is absent from Cloud navigation', () => {
  assert.equal(cloudNavigation([]).some(item=>item.href==='/cloud/apps'),false)
  assert.deepEqual(cloudNavigation([]).map(item=>item.label),['Overview','Projects','Activity','Billing','Settings'])
})
