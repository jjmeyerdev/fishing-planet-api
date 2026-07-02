import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { routes } from './routes/index.js'

export const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/', (c) => c.json({ name: 'fishing-planet-api', status: 'ok' }))
app.get('/health', (c) => c.json({ status: 'healthy' }))

app.route('/api', routes)

app.onError((err, c) => {
  // HTTPException messages are intentional (400/404 from the routes); pass them
  // through. Anything else is an unexpected server error — log it, but don't
  // leak the raw message (it can carry Prisma query/column details).
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})
