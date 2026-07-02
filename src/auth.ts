import type { MiddlewareHandler } from 'hono'

// Reads (and CORS preflight) are public; only these mutate state and need a key.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

interface AuthOptions {
  keys: string[]
}

// API-key auth for writes: GET/HEAD/OPTIONS stay public; other methods require
// `Authorization: Bearer <key>` matching one of the configured keys, else 401.
// With no keys configured it's a no-op (auth disabled) — set API_KEYS to enforce.
export function apiKeyAuth({ keys }: AuthOptions): MiddlewareHandler {
  const valid = new Set(keys)
  return async (c, next) => {
    if (valid.size === 0 || READ_METHODS.has(c.req.method)) return next()
    const match = (c.req.header('authorization') ?? '').match(/^Bearer\s+(.+)$/i)
    if (!match || !valid.has(match[1])) {
      c.header('WWW-Authenticate', 'Bearer')
      return c.json({ error: 'Unauthorized' }, 401)
    }
    return next()
  }
}
