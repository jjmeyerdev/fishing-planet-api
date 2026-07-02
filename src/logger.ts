import { randomUUID } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

// Adds a per-request id to the context so handlers/onError can correlate logs.
export type LogEnv = { Variables: { requestId: string } }

type Level = 'info' | 'warn' | 'error'

// Emit one JSON log line. Suppressed when LOG_SILENT is set (the test suite).
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (process.env.LOG_SILENT) return
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields })
  ;(level === 'error' ? console.error : console.log)(line)
}

// Pure probe / scrape traffic would drown out real requests; don't log it.
const SKIP_PATHS = new Set(['/health', '/ready', '/metrics'])

// Structured request logger: assigns/propagates X-Request-Id and logs one line
// per completed request. Errors that throw are logged by app.onError instead.
export function requestLogger(): MiddlewareHandler<LogEnv> {
  return async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? randomUUID()
    c.set('requestId', requestId)
    c.header('x-request-id', requestId)
    const start = Date.now()
    await next()
    // Errors that threw are logged by app.onError (with detail); skip here to
    // avoid a duplicate line. Returned (non-throwing) 4xx still log below.
    if (SKIP_PATHS.has(c.req.path) || c.error) return
    const status = c.res.status
    const level: Level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    log(level, 'request', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs: Date.now() - start,
    })
  }
}
