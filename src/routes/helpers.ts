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

// Read an optional integer query param: undefined if absent/blank, or 400 if
// present but not an integer (rather than forwarding NaN into a Prisma filter).
export function intQuery(c: Context, name: string): number | undefined {
  const raw = c.req.query(name)
  if (!raw) return undefined
  const value = Number(raw)
  if (!Number.isInteger(value)) throw new HTTPException(400, { message: `Invalid ${name}` })
  return value
}

// A whitelisted list filter: which query param maps to which column, and how to
// interpret it. `search` is a case-insensitive substring match; the rest are
// exact.
export type FilterSpec = {
  param: string
  field: string
  kind: 'string' | 'search' | 'int' | 'boolean'
}

// Build a Prisma `where` from whitelisted query params. Params not in the spec
// (limit, offset, unknown ones) are ignored, so filters coexist with
// pagination. A malformed int/boolean value is a 400.
export function buildWhere(c: Context, filters: readonly FilterSpec[]): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  for (const f of filters) {
    const raw = c.req.query(f.param)
    if (!raw) continue
    switch (f.kind) {
      case 'string':
        where[f.field] = raw
        break
      case 'search':
        where[f.field] = { contains: raw, mode: 'insensitive' }
        break
      case 'int': {
        const n = Number(raw)
        if (!Number.isInteger(n)) throw new HTTPException(400, { message: `Invalid ${f.param}` })
        where[f.field] = n
        break
      }
      case 'boolean':
        if (raw !== 'true' && raw !== 'false') {
          throw new HTTPException(400, { message: `${f.param} must be true or false` })
        }
        where[f.field] = raw === 'true'
        break
    }
  }
  return where
}

// Parse ?sort=&order= against a per-route whitelist, returning a Prisma
// `orderBy`, or undefined so the caller keeps its default order. `order`
// defaults to asc; an unknown sort field or a bad order value is a 400.
export function sortOrder(c: Context, sortable: readonly string[]): Record<string, 'asc' | 'desc'> | undefined {
  const field = c.req.query('sort')
  if (!field) return undefined
  if (!sortable.includes(field)) {
    throw new HTTPException(400, { message: `Invalid sort field: ${field}` })
  }
  const order = c.req.query('order') ?? 'asc'
  if (order !== 'asc' && order !== 'desc') {
    throw new HTTPException(400, { message: "order must be 'asc' or 'desc'" })
  }
  return { [field]: order }
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// Parse ?limit=&offset= for a list endpoint, applying defaults and bounds, or
// 400 on an out-of-range value. Feeds Prisma's `take`/`skip`.
export function pageParams(c: Context): { limit: number; offset: number } {
  const limit = intQuery(c, 'limit') ?? DEFAULT_LIMIT
  const offset = intQuery(c, 'offset') ?? 0
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new HTTPException(400, { message: `limit must be between 1 and ${MAX_LIMIT}` })
  }
  if (offset < 0) {
    throw new HTTPException(400, { message: 'offset must be >= 0' })
  }
  return { limit, offset }
}

// Extract a Prisma known-request-error code (e.g. 'P2002') if present.
function prismaCode(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

// Prisma throws PrismaClientValidationError (no error code) when the input data
// is missing a required field or has the wrong type.
function isValidationError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { name?: unknown }).name === 'PrismaClientValidationError'
  )
}

// Run a Prisma write, translating its expected failures into client 4xx errors
// instead of a blanket 500:
//   P2025 missing row            -> 404
//   P2002 unique violation       -> 409
//   P2003 foreign-key violation  -> 400 (references a row that doesn't exist)
//   invalid/missing input fields -> 400
// Anything else propagates and surfaces as a 500.
export async function orClientError<T>(op: Promise<T>): Promise<T> {
  try {
    return await op
  } catch (e) {
    if (isNotFound(e)) throw new HTTPException(404, { message: 'Not found' })
    const code = prismaCode(e)
    if (code === 'P2002') throw new HTTPException(409, { message: 'Already exists' })
    if (code === 'P2003') throw new HTTPException(400, { message: 'Invalid reference' })
    if (isValidationError(e)) throw new HTTPException(400, { message: 'Invalid request body' })
    throw e
  }
}
