import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

// Pool sizing/timeouts (the adapter builds a pg Pool from this). A bounded
// connectionTimeout means an unreachable DB fails fast as a connection error
// (mapped to 503) instead of hanging the request.
const adapter = new PrismaPg({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export const prisma = new PrismaClient({ adapter })
