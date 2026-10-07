import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {withDeployDatabase} from '../../deploy/helpers/postgres'
import {applyFoundation,applyOwnerPolicy,freeOwnerId} from '../../deploy/helpers/fixtures'
import {createAuthTransaction,hashToken} from '../../../src/lib/cloud/oidc'
import {persistAuthTransaction,consumeAuthTransaction,createSession,revokeSession} from '../../../src/lib/cloud/session'

test('OIDC transactions can be consumed once, and expired transactions fail closed', async () => {
  await withDeployDatabase(async pool => {
    await applyFoundation(pool)
    await applyOwnerPolicy(pool)
    await pool.query(await readFile('db/cloud/001-control-plane.sql','utf8'))
    const tx=createAuthTransaction('/cloud/projects')
    await persistAuthTransaction(tx,pool)
    const results=await Promise.allSettled([consumeAuthTransaction(tx.state,pool),consumeAuthTransaction(tx.state,pool)])
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
    assert.equal(results.filter(r=>r.status==='rejected').length,1)
    const expired=createAuthTransaction('/cloud')
    await persistAuthTransaction(expired,pool)
    await pool.query("UPDATE cloud_oidc_transactions SET expires_at=statement_timestamp()-interval '1 second' WHERE state_hash=$1",[hashToken(expired.state)])
    await assert.rejects(consumeAuthTransaction(expired.state,pool),/identity_transaction_expired/)
  })
})

test('sessions require a registered subject, store hashes, and support immediate revocation', async () => {
  await withDeployDatabase(async pool => {
    await applyFoundation(pool)
    await applyOwnerPolicy(pool)
    await pool.query(await readFile('db/cloud/001-control-plane.sql','utf8'))
    await assert.rejects(createSession('unknown-oidc-subject',pool),/account_not_registered/)
    const token=await createSession(freeOwnerId,pool)
    const stored=await pool.query('SELECT token_hash,user_id FROM cloud_sessions')
    assert.equal(stored.rows[0].token_hash,hashToken(token))
    assert.notEqual(stored.rows[0].token_hash,token)
    assert.equal(stored.rows[0].user_id,freeOwnerId)
    await revokeSession(token,pool)
    assert.equal((await pool.query('SELECT token_hash FROM cloud_sessions')).rowCount,0)
  })
})
