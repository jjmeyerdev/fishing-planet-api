import type { MiddlewareHandler } from 'hono'

// The dataset is essentially static game data — it only changes on a reseed — so
// successful reads are tagged for a shared/CDN cache (e.g. Vercel's edge) to take
// load off the pooled Neon connection and cut latency. `max-age=0` keeps browsers
// revalidating; `s-maxage` lets the CDN serve for an hour and
// `stale-while-revalidate` refresh in the background for a day. Only `GET` `200`s
// are tagged, so writes and error responses (400/404/503) are never cached.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'

export function cacheControl(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    if (c.req.method === 'GET' && c.res.status === 200) {
      c.res.headers.set('Cache-Control', CACHE_CONTROL)
    }
  }
}
