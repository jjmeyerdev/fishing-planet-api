import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db.js'
import { readJson, pick, orNotFound } from './helpers.js'

// Composite primary key: (fishId, locationId, specificSpot).
const CREATE_FIELDS = ['fishId', 'locationId', 'specificSpot', 'classesPresent'] as const

function keyFromQuery(c: Context) {
  const fishId = Number(c.req.query('fishId'))
  const locationId = Number(c.req.query('locationId'))
  const specificSpot = c.req.query('specificSpot')
  if (!Number.isInteger(fishId) || !Number.isInteger(locationId) || !specificSpot) return null
  return { fishId, locationId, specificSpot }
}

export const fishLocations = new Hono()

// List; optionally filter by ?fishId= and/or ?locationId=
fishLocations.get('/', async (c) => {
  const where: Prisma.FishLocationWhereInput = {}
  const fishId = c.req.query('fishId')
  const locationId = c.req.query('locationId')
  if (fishId) where.fishId = Number(fishId)
  if (locationId) where.locationId = Number(locationId)
  const rows = await prisma.fishLocation.findMany({ where, orderBy: [{ fishId: 'asc' }, { locationId: 'asc' }] })
  return c.json(rows)
})

fishLocations.post('/', async (c) => {
  const body = await readJson(c)
  const created = await prisma.fishLocation.create({
    data: pick<Prisma.FishLocationUncheckedCreateInput>(body, CREATE_FIELDS),
  })
  return c.json(created, 201)
})

// Update classesPresent for the row identified by ?fishId=&locationId=&specificSpot=
fishLocations.patch('/', async (c) => {
  const key = keyFromQuery(c)
  if (!key) return c.json({ error: 'fishId, locationId and specificSpot query params are required' }, 400)
  const body = await readJson(c)
  const updated = await orNotFound(prisma.fishLocation.update({
    where: { fishId_locationId_specificSpot: key },
    data: pick<Prisma.FishLocationUncheckedUpdateInput>(body, ['classesPresent']),
  }))
  return c.json(updated)
})

fishLocations.delete('/', async (c) => {
  const key = keyFromQuery(c)
  if (!key) return c.json({ error: 'fishId, locationId and specificSpot query params are required' }, 400)
  await orNotFound(prisma.fishLocation.delete({ where: { fishId_locationId_specificSpot: key } }))
  return c.body(null, 204)
})
