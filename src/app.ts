import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { prisma } from './db.js'
import { docs } from './docs.js'
import { rateLimit } from './rateLimit.js'
import { apiKeyAuth } from './auth.js'
import { isConnectionError } from './routes/helpers.js'
import { routes } from './routes/index.js'

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 100)
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000)
const API_KEYS = (process.env.API_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean)

export const app = new Hono()

app.use('*', logger())
app.use('*', cors())

// Rate limit the data API only — liveness/readiness probes and /docs are exempt.
app.use('/api/*', rateLimit({ max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS }))

// API-key auth on the data API: reads are public, writes require a key.
app.use('/api/*', apiKeyAuth({ keys: API_KEYS }))

app.get('/', (c) => c.json({ name: 'fishing-planet-api', status: 'ok' }))

// Liveness: the process is up. Deliberately does not touch the DB, so a DB
// blip doesn't make an orchestrator kill an otherwise-healthy app.
app.get('/health', (c) => c.json({ status: 'healthy' }))

// Readiness: can the app actually serve? Pings the DB; 503 when unreachable.
app.get('/ready', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return c.json({ status: 'ready' })
  } catch {
    return c.json({ status: 'unavailable' }, 503)
  }
})

// Swagger UI at /docs, raw spec at /openapi.yaml.
app.route('/', docs)

app.route('/api', routes)

app.onError((err, c) => {
  // HTTPException messages are intentional (400/404 from the routes); pass them
  // through. Anything else is an unexpected server error — log it, but don't
  // leak the raw message (it can carry Prisma query/column details). A DB
  // connection failure is a 503 (transient/infra), not a 500.
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  if (isConnectionError(err)) return c.json({ error: 'Database unavailable' }, 503)
  return c.json({ error: 'Internal server error' }, 500)
})
