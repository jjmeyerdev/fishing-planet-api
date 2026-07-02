import { Hono } from 'hono'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { readJson, pick, intParam, orClientError } from './helpers.js'

// Keyed one-to-one on fishId.
const CREATE_FIELDS = [
  'fishId', 'preferredBaits', 'preferredLures', 'preferredLureColors',
  'hookSizeMin', 'hookSizeMax', 'depthZone',
  'sunnyPeakTimes', 'cloudyPeakTimes', 'rainyPeakTimes',
] as const
const UPDATE_FIELDS = CREATE_FIELDS.filter((f) => f !== 'fishId')

export const bitingPreferences = new Hono()

bitingPreferences.get('/', async (c) => {
  const rows = await prisma.bitingPreference.findMany({ orderBy: { fishId: 'asc' } })
  return c.json(rows)
})

bitingPreferences.get('/:fishId', async (c) => {
  const fishId = intParam(c, 'fishId')
  const row = await prisma.bitingPreference.findUnique({ where: { fishId } })
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

bitingPreferences.post('/', async (c) => {
  const body = await readJson(c)
  const created = await orClientError(prisma.bitingPreference.create({
    data: pick<Prisma.BitingPreferenceUncheckedCreateInput>(body, CREATE_FIELDS),
  }))
  return c.json(created, 201)
})

bitingPreferences.patch('/:fishId', async (c) => {
  const fishId = intParam(c, 'fishId')
  const body = await readJson(c)
  const updated = await orClientError(prisma.bitingPreference.update({
    where: { fishId },
    data: pick<Prisma.BitingPreferenceUncheckedUpdateInput>(body, UPDATE_FIELDS),
  }))
  return c.json(updated)
})

bitingPreferences.delete('/:fishId', async (c) => {
  const fishId = intParam(c, 'fishId')
  await orClientError(prisma.bitingPreference.delete({ where: { fishId } }))
  return c.body(null, 204)
})
