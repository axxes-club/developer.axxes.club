import test from 'node:test'
import assert from 'node:assert/strict'
import {formatMicroUsd} from '../../src/lib/cloud/money'
test('financial display preserves cents and large integer amounts', () => {
  assert.equal(formatMicroUsd(0n), '$0.00')
  assert.equal(formatMicroUsd(10000n), '$0.01')
  assert.equal(formatMicroUsd(39990000n), '$39.99')
  assert.equal(formatMicroUsd(-1500000n), '-$1.50')
  assert.equal(formatMicroUsd(9007199254740991000000n), '$9007199254740991.00')
})
