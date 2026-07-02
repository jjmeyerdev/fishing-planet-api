import 'dotenv/config'
import type { Server } from 'node:http'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { prisma } from './db.js'
import { log } from './logger.js'

const port = Number(process.env.PORT) || 8080
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000)

const server = serve({ fetch: app.fetch, port }, (info) => {
  log('info', 'server started', { port: info.port, url: `http://localhost:${info.port}` })
})

let shuttingDown = false
function shutdown(signal: string): void {
  if (shuttingDown) return
  shuttingDown = true
  log('info', 'shutdown initiated', { signal })

  // Backstop: if draining stalls (e.g. a hung request), exit rather than hang.
  const force = setTimeout(() => {
    log('error', 'shutdown timed out, forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  force.unref()

  // Stop accepting connections and let in-flight requests finish.
  server.close(async (err) => {
    if (err) log('error', 'error closing server', { error: err.message })
    try {
      await prisma.$disconnect()
    } catch (e) {
      log('error', 'error disconnecting database', { error: (e as Error).message })
    }
    clearTimeout(force)
    log('info', 'shutdown complete')
    process.exit(err ? 1 : 0)
  })
  // Drop idle keep-alive sockets so close() isn't held open by them.
  ;(server as Server).closeIdleConnections?.()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
