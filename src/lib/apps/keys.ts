import "server-only"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db, schema } from "@/lib/db"

/**
 * API keys and OAuth client secrets.
 *
 * Both are `a_axxes_<id>_<secret>`. The id is located by position, not by
 * splitting on "_": base64url emits "_" as a character, so roughly half of
 * all secrets contain one and a split would reject the tokens that happened
 * to be minted with it. This is the third product to get this wrong, so it
 * is written down here rather than re-derived.
 */
const SECRET_BYTES = 32
const ID_BYTES = 9
const ID_HEX_LENGTH = ID_BYTES * 2
export const KEY_PREFIX = "a_axxes"

const sha256 = (input: string) => createHash("sha256").update(input).digest("hex")

export function mintSecret() {
  const id = randomBytes(ID_BYTES).toString("hex")
  const secret = randomBytes(SECRET_BYTES).toString("base64url")
  return { id, secret, token: `${KEY_PREFIX}_${id}_${secret}`, hash: sha256(secret) }
}

export function idFrom(token: string): string | null {
  const head = `${KEY_PREFIX}_`
  if (!token.startsWith(head)) return null
  const rest = token.slice(head.length)
  const id = rest.slice(0, ID_HEX_LENGTH)
  if (id.length !== ID_HEX_LENGTH || !/^[0-9a-f]+$/.test(id)) return null
  if (rest[ID_HEX_LENGTH] !== "_") return null
  return rest.slice(ID_HEX_LENGTH + 1).length > 0 ? id : null
}

export function secretFrom(token: string): string {
  return token.slice(`${KEY_PREFIX}_`.length + ID_HEX_LENGTH + 1)
}

export function matches(candidate: string, storedHash: string): boolean {
  const a = Buffer.from(sha256(candidate), "hex")
  const b = Buffer.from(storedHash, "hex")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function createKey(input: {
  appId: string
  tenantId: string
  userId: string
  name: string
  products: string[]
  scopes: string[]
  expiresInDays?: number | null
  rateLimitPerMinute?: number | null
}) {
  const { id, token, hash } = mintSecret()
  const [row] = await db
    .insert(schema.apiKeys)
    .values({
      keyId: id,
      hash,
      prefix: `${KEY_PREFIX}_${id.slice(0, 6)}`,
      appId: input.appId,
      tenantId: input.tenantId,
      name: input.name,
      products: input.products,
      scopes: input.scopes,
      rateLimitPerMinute: input.rateLimitPerMinute ?? null,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null,
      createdById: input.userId,
    })
    .returning()
  return { row, key: token }
}

export async function listKeys(appId: string) {
  return db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      prefix: schema.apiKeys.prefix,
      products: schema.apiKeys.products,
      scopes: schema.apiKeys.scopes,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      useCount: schema.apiKeys.useCount,
      expiresAt: schema.apiKeys.expiresAt,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.appId, appId), isNull(schema.apiKeys.revokedAt)))
    .orderBy(desc(schema.apiKeys.createdAt))
}

export async function resolveKey(raw: string) {
  const keyId = idFrom(raw)
  if (!keyId) return null
  const [row] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyId, keyId)).limit(1)
  if (!row || !row.hash || row.revokedAt) return null
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null
  if (!matches(secretFrom(raw), row.hash)) return null
  return row
}

export async function revokeKey(appId: string, keyId: string) {
  await db
    .update(schema.apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.appId, appId)))
}

export async function touchKey(keyId: string, ip?: string) {
  try {
    const { sql } = await import("drizzle-orm")
    await db
      .update(schema.apiKeys)
      .set({ lastUsedAt: new Date(), lastUsedIp: ip ?? null, useCount: sql`${schema.apiKeys.useCount} + 1` })
      .where(eq(schema.apiKeys.keyId, keyId))
  } catch {
    /* an audit write is not worth failing a request over */
  }
}
