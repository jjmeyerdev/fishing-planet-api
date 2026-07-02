import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client'
import type { MiddlewareHandler } from 'hono'

// Own registry so tests/instances stay isolated; includes Node process/runtime
// metrics (heap, GC, event-loop lag, CPU).
export const registry = new Registry()
collectDefaultMetrics({ register: registry })

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests.',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
})

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
})

// Don't measure the scrape endpoint (self) or pure probes.
const SKIP = new Set(['/metrics', '/health', '/ready'])

// Record a counter + duration sample per request, labeled by the matched route
// *pattern* (e.g. /api/fish/:id) to bound label cardinality. The finally runs
// with the final status even when the handler threw (onError has already set it).
export function metricsMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    if (SKIP.has(c.req.path)) return next()
    const stopTimer = httpRequestDuration.startTimer()
    try {
      await next()
    } finally {
      const labels = { method: c.req.method, route: c.req.routePath, status: String(c.res.status) }
      httpRequestsTotal.inc(labels)
      stopTimer(labels)
    }
  }
}
