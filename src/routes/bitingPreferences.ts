import { Hono } from 'hono'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { readJson, pick, intParam, pageParams, buildWhere, orClientError } from './helpers.js'
import type { FilterSpec } from './helpers.js'

// Keyed one-to-one on fishId.
const CREATE_FIELDS = [
  'fishId', 'preferredBaits', 'preferredLures', 'preferredLureColors',
  'hookSizeMin', 'hookSizeMax', 'depthZone',
  'sunnyPeakTimes', 'cloudyPeakTimes', 'rainyPeakTimes',
] as const
const UPDATE_FIELDS = CREATE_FIELDS.filter((f) => f !== 'fishId')

const FILTERS: FilterSpec[] = [
  { param: 'depthZone', field: 'depthZone', kind: 'string' },
]

export const bitingPreferences = new Hono()

bitingPreferences.get('/', async (c) => {
  const { limit, offset } = pageParams(c)
  const where = buildWhere(c, FILTERS) as Prisma.BitingPreferenceWhereInput
  const [data, total] = await Promise.all([
    prisma.bitingPreference.findMany({ where, orderBy: { fishId: 'asc' }, skip: offset, take: limit }),
    prisma.bitingPreference.count({ where }),
  ])
  return c.json({ data, total, limit, offset })
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
