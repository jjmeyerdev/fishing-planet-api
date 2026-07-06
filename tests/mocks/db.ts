import { vi } from 'vitest'

// A stand-in for one Prisma model delegate — only the methods the routes use.
const model = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
})

// Replaces the real `prisma` from src/db.js so route tests need no database.
// vi.mock('../src/db.js', () => import('./mocks/db.js')) makes the app import
// this exact object, so tests configure behaviour by driving these mocks.
export const prisma = {
  $queryRaw: vi.fn(),
  fish: model(),
  location: model(),
  fishLocation: model(),
  bitingPreference: model(),
  bait: model(),
  boilie: model(),
  lureType: model(),
  lure: model(),
  hook: model(),
  jighead: model(),
  sinker: model(),
  keepnet: model(),
  addon: model(),
}
