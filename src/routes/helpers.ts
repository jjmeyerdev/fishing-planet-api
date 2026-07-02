import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

// Parse the request body as a JSON object, or fail with 400 (not 500) when it's
// malformed or isn't an object — the latter would otherwise trip `pick`'s
// `key in body` on null/primitives.
export async function readJson(c: Context): Promise<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HTTPException(400, { message: 'Request body must be a JSON object' })
  }
  return parsed as Record<string, unknown>
}

// Copy only whitelisted keys that are present in the request body.
export function pick<T>(body: Record<string, unknown>, keys: readonly string[]): T {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in body) out[key] = body[key]
  }
  return out as T
}

// Prisma throws P2025 when an update/delete targets a row that doesn't exist.
export function isNotFound(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === 'P2025'
  )
}

// Read a required integer route param, or fail with 400.
export function intParam(c: Context, name: string): number {
  const value = Number(c.req.param(name))
  if (!Number.isInteger(value)) throw new HTTPException(400, { message: `Invalid ${name}` })
  return value
}

// Run a Prisma write, translating a missing-row P2025 into a 404.
export async function orNotFound<T>(op: Promise<T>): Promise<T> {
  try {
    return await op
  } catch (e) {
    if (isNotFound(e)) throw new HTTPException(404, { message: 'Not found' })
    throw e
  }
}
