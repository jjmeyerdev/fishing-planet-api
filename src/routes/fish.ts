import { Hono } from 'hono'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { readJson, pick, intParam, pageParams, buildWhere, sortOrder, orClientError } from './helpers.js'
import type { FilterSpec } from './helpers.js'

const FIELDS = [
  'commonName', 'scientificName', 'family', 'description', 'isEventFish', 'isMonster',
  'weightYoungMin', 'weightYoungMax', 'weightCommonMin', 'weightCommonMax', 'weightTrophyMin',
  'weightUniqueMin', 'weightUniqueMax', 'monsterTargetWeight',
  'creditsPerKgCommon', 'creditsPerKgTrophy', 'creditsPerKgUnique',
  'xpCurveNotes', 'farmingMetaTier', 'notesFarming', 'dataVersion', 'lastVerified',
] as const

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'commonName', kind: 'search' },
  { param: 'family', field: 'family', kind: 'string' },
  { param: 'isMonster', field: 'isMonster', kind: 'boolean' },
  { param: 'isEventFish', field: 'isEventFish', kind: 'boolean' },
]

const SORTABLE = ['id', 'commonName', 'family', 'creditsPerKgUnique', 'monsterTargetWeight']

export const fish = new Hono()

fish.get('/', async (c) => {
  const { limit, offset } = pageParams(c)
  const where = buildWhere(c, FILTERS) as Prisma.FishWhereInput
  const orderBy = (sortOrder(c, SORTABLE) ?? { id: 'asc' }) as Prisma.FishOrderByWithRelationInput
  const [data, total] = await Promise.all([
    prisma.fish.findMany({ where, orderBy, skip: offset, take: limit }),
    prisma.fish.count({ where }),
  ])
  return c.json({ data, total, limit, offset })
})

// Lookup by the unique commonName (exact; the ?q= list filter covers fuzzy
// search). URL-encoded names decode automatically (e.g. Largemouth%20Bass).
fish.get('/by-name/:name', async (c) => {
  const row = await prisma.fish.findUnique({
    where: { commonName: c.req.param('name') },
    include: { bitingPreference: true },
  })
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

fish.get('/:id', async (c) => {
  const id = intParam(c, 'id')
  const row = await prisma.fish.findUnique({ where: { id }, include: { bitingPreference: true } })
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

fish.post('/', async (c) => {
  const body = await readJson(c)
  const created = await orClientError(prisma.fish.create({ data: pick<Prisma.FishCreateInput>(body, FIELDS) }))
  return c.json(created, 201)
})

fish.patch('/:id', async (c) => {
  const id = intParam(c, 'id')
  const body = await readJson(c)
  const updated = await orClientError(prisma.fish.update({ where: { id }, data: pick<Prisma.FishUpdateInput>(body, FIELDS) }))
  return c.json(updated)
})

fish.delete('/:id', async (c) => {
  const id = intParam(c, 'id')
  await orClientError(prisma.fish.delete({ where: { id } }))
  return c.body(null, 204)
})
