import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, MiddlewareHandler } from 'hono'

// Prefer the proxy-supplied client IP; fall back to the socket address, then a
// shared bucket if neither is available.
function clientKey(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

interface RateLimitOptions {
  max: number
  windowMs: number
}

// Fixed-window, in-memory rate limiter keyed by client IP. Counters live in this
// process only — each instance limits independently, which is fine for the
// single-container deployment (swap in a shared store like Redis to limit across
// instances). `max <= 0` disables it.
export function rateLimit({ max, windowMs }: RateLimitOptions): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>()
  let lastSweep = 0

  return async (c, next) => {
    if (max <= 0) return next()
    const now = Date.now()

    // Drop expired buckets periodically so idle keys don't accumulate.
    if (now - lastSweep > windowMs) {
      for (const [k, e] of hits) if (now >= e.resetAt) hits.delete(k)
      lastSweep = now
    }

    const key = clientKey(c)
    let entry = hits.get(key)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }
    entry.count++

    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000)
    c.header('RateLimit-Limit', String(max))
    c.header('RateLimit-Remaining', String(Math.max(0, max - entry.count)))
    c.header('RateLimit-Reset', String(resetSeconds))

    if (entry.count > max) {
      c.header('Retry-After', String(resetSeconds))
      return c.json({ error: 'Too many requests' }, 429)
    }
    return next()
  }
}
