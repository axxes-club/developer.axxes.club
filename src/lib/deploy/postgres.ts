import { Pool, type PoolClient } from 'pg'

// Separate financial connection: never emulate transactions with the Neon HTTP client.
const globalPool = globalThis as unknown as { axxesDeployPool?: Pool }
export function hostingPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('Hosting database is not configured')
  const pool = globalPool.axxesDeployPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 })
  if (pool.listenerCount('error') === 0) pool.on('error', () => console.error('[deploy] database connection error'))
  return pool
}
export async function inHostingTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}
