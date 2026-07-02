import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { log } from './logger.js'

const port = Number(process.env.PORT) || 8080

serve({ fetch: app.fetch, port }, (info) => {
  log('info', 'server started', { port: info.port, url: `http://localhost:${info.port}` })
})
