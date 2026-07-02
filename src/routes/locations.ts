import { Hono } from 'hono'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { readJson, pick, intParam, pageParams, buildWhere, sortOrder, orClientError } from './helpers.js'
import type { FilterSpec } from './helpers.js'

const FIELDS = ['name', 'region', 'waterwayType', 'unlockLevel'] as const

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'name', kind: 'search' },
  { param: 'region', field: 'region', kind: 'string' },
  { param: 'waterwayType', field: 'waterwayType', kind: 'string' },
  { param: 'unlockLevel', field: 'unlockLevel', kind: 'int' },
]

const SORTABLE = ['id', 'name', 'region', 'waterwayType', 'unlockLevel']

export const locations = new Hono()

locations.get('/', async (c) => {
  const { limit, offset } = pageParams(c)
  const where = buildWhere(c, FILTERS) as Prisma.LocationWhereInput
  const orderBy = (sortOrder(c, SORTABLE) ?? { id: 'asc' }) as Prisma.LocationOrderByWithRelationInput
  const [data, total] = await Promise.all([
    prisma.location.findMany({ where, orderBy, skip: offset, take: limit }),
    prisma.location.count({ where }),
  ])
  return c.json({ data, total, limit, offset })
})

locations.get('/:id', async (c) => {
  const id = intParam(c, 'id')
  const row = await prisma.location.findUnique({ where: { id } })
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

locations.post('/', async (c) => {
  const body = await readJson(c)
  const created = await orClientError(prisma.location.create({ data: pick<Prisma.LocationCreateInput>(body, FIELDS) }))
  return c.json(created, 201)
})

locations.patch('/:id', async (c) => {
  const id = intParam(c, 'id')
  const body = await readJson(c)
  const updated = await orClientError(prisma.location.update({ where: { id }, data: pick<Prisma.LocationUpdateInput>(body, FIELDS) }))
  return c.json(updated)
})

locations.delete('/:id', async (c) => {
  const id = intParam(c, 'id')
  await orClientError(prisma.location.delete({ where: { id } }))
  return c.body(null, 204)
})
