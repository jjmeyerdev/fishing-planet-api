import { Hono } from 'hono'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { readJson, pick, intParam, orNotFound } from './helpers.js'

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
  const id = intParam(c, 'id')
  const row = await prisma.fish.findUnique({ where: { id }, include: { bitingPreference: true } })
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

fish.post('/', async (c) => {
  const body = await readJson(c)
  const created = await prisma.fish.create({ data: pick<Prisma.FishCreateInput>(body, FIELDS) })
  return c.json(created, 201)
})

fish.patch('/:id', async (c) => {
  const id = intParam(c, 'id')
  const body = await readJson(c)
  const updated = await orNotFound(prisma.fish.update({ where: { id }, data: pick<Prisma.FishUpdateInput>(body, FIELDS) }))
  return c.json(updated)
})

fish.delete('/:id', async (c) => {
  const id = intParam(c, 'id')
  await orNotFound(prisma.fish.delete({ where: { id } }))
  return c.body(null, 204)
})
