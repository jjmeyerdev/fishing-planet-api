import { Hono } from 'hono'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { pick, isNotFound } from './helpers.js'

const FIELDS = [
  'commonName', 'scientificName', 'family', 'description', 'isEventFish', 'isMonster',
  'weightYoungMin', 'weightYoungMax', 'weightCommonMin', 'weightCommonMax', 'weightTrophyMin',
  'weightUniqueMin', 'weightUniqueMax', 'monsterTargetWeight',
  'creditsPerKgCommon', 'creditsPerKgTrophy', 'creditsPerKgUnique',
  'xpCurveNotes', 'farmingMetaTier', 'notesFarming', 'dataVersion', 'lastVerified',
] as const

export const fish = new Hono()

fish.get('/', async (c) => {
  const rows = await prisma.fish.findMany({ orderBy: { id: 'asc' } })
  return c.json(rows)
})

fish.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400)
  const row = await prisma.fish.findUnique({ where: { id }, include: { bitingPreference: true } })
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

fish.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()
  const created = await prisma.fish.create({ data: pick<Prisma.FishCreateInput>(body, FIELDS) })
  return c.json(created, 201)
})

fish.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400)
  const body = await c.req.json<Record<string, unknown>>()
  try {
    const updated = await prisma.fish.update({ where: { id }, data: pick<Prisma.FishUpdateInput>(body, FIELDS) })
    return c.json(updated)
  } catch (e) {
    if (isNotFound(e)) return c.json({ error: 'Not found' }, 404)
    throw e
  }
})

fish.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400)
  try {
    await prisma.fish.delete({ where: { id } })
    return c.body(null, 204)
  } catch (e) {
    if (isNotFound(e)) return c.json({ error: 'Not found' }, 404)
    throw e
  }
})
