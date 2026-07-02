import { Hono } from 'hono'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { readJson, pick, intParam, pageParams, orClientError } from './helpers.js'

const FIELDS = ['name', 'region', 'waterwayType', 'unlockLevel'] as const

export const locations = new Hono()

locations.get('/', async (c) => {
  const { limit, offset } = pageParams(c)
  const [data, total] = await Promise.all([
    prisma.location.findMany({ orderBy: { id: 'asc' }, skip: offset, take: limit }),
    prisma.location.count(),
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
