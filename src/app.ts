import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { routes } from './routes/index.js'

export const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/', (c) => c.json({ name: 'fishing-planet-api', status: 'ok' }))
app.get('/health', (c) => c.json({ status: 'healthy' }))

app.route('/api', routes)

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message }, 500)
})
