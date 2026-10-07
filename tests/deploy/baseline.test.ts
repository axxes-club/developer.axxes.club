import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateTestDatabaseUrl, withDeployDatabase } from './helpers/postgres'

test('test harness never falls back to application or production databases', () => {
  for (const url of [undefined, '', 'postgresql://ci:ci@prod.example.com/ci', 'postgresql://ci:ci@localhost/axxes_primary', 'postgresql://ci:ci@localhost/ci?options=-csearch_path=public']) {
    assert.throws(() => validateTestDatabaseUrl(url))
  }
  assert.equal(validateTestDatabaseUrl('postgresql://ci:ci@127.0.0.1:5432/ci'), 'postgresql://ci:ci@127.0.0.1:5432/ci')
})

test('temporary schema supports queries and is dropped after callback failure', async () => {
  let schemaName = ''
  await assert.rejects(withDeployDatabase(async pool => {
    const {rows} = await pool.query('SELECT current_schema() AS name')
    schemaName = rows[0].name
    await pool.query('CREATE TABLE fixture (value integer)')
    await pool.query('INSERT INTO fixture VALUES (7)')
    assert.equal((await pool.query('SELECT value FROM fixture')).rows[0].value, 7)
    throw new Error('fixture failure')
  }), /fixture failure/)
  await withDeployDatabase(async pool => {
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1', [schemaName])).rows[0].n, 0)
  })
})
