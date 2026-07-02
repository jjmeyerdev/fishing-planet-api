import { describe, it, expect, beforeEach, vi } from 'vitest'

// Route files import `prisma` from src/db.js; swap it for the DB-free mock.
vi.mock('../src/db.js', () => import('./mocks/db.js'))

import { app } from '../src/app.js'
import { prisma } from './mocks/db.js'

const P2025 = { code: 'P2025' }
const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

beforeEach(() => {
  vi.clearAllMocks()
})

// The three id-in-path resources are structurally identical CRUD wrappers.
type Key = 'fish' | 'location' | 'bitingPreference'
interface Resource {
  label: string
  base: string
  key: Key
  create: Record<string, unknown>
  junk: Record<string, unknown>
  patch: Record<string, unknown>
}

const RESOURCES: Resource[] = [
  {
    label: 'fish',
    base: '/api/fish',
    key: 'fish',
    create: { commonName: 'Largemouth Bass' },
    junk: { id: 999, bogus: 'nope' },
    patch: { description: 'updated' },
  },
  {
    label: 'locations',
    base: '/api/locations',
    key: 'location',
    create: { name: 'Emerald Lake', region: 'US' },
    junk: { id: 999, bogus: 'nope' },
    patch: { unlockLevel: 5 },
  },
  {
    label: 'biting-preferences',
    base: '/api/biting-preferences',
    key: 'bitingPreference',
    create: { fishId: 1, depthZone: 'shallow' },
    junk: { bogus: 'nope' },
    patch: { depthZone: 'deep' },
  },
]

describe.each(RESOURCES)('$label CRUD', ({ base, key, create, junk, patch }) => {
  const m = () => prisma[key]

  it('GET list returns rows', async () => {
    m().findMany.mockResolvedValue([{ id: 1 }])
    const res = await app.request(base)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1 }])
    expect(m().findMany).toHaveBeenCalledOnce()
  })

  it('GET one rejects a non-numeric id with 400', async () => {
    const res = await app.request(`${base}/abc`)
    expect(res.status).toBe(400)
    expect(m().findUnique).not.toHaveBeenCalled()
  })

  it('GET one returns 404 when missing', async () => {
    m().findUnique.mockResolvedValue(null)
    const res = await app.request(`${base}/1`)
    expect(res.status).toBe(404)
  })

  it('GET one returns the row when found', async () => {
    m().findUnique.mockResolvedValue({ id: 1 })
    const res = await app.request(`${base}/1`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 1 })
  })

  it('POST creates with only whitelisted fields and returns 201', async () => {
    m().create.mockResolvedValue({ id: 1, ...create })
    const res = await app.request(base, json({ ...create, ...junk }))
    expect(res.status).toBe(201)
    // Non-whitelisted keys (id, bogus, …) must be stripped by pick().
    expect(m().create).toHaveBeenCalledWith({ data: create })
  })

  it('PATCH returns 404 when the target is missing', async () => {
    m().update.mockRejectedValue(P2025)
    const res = await app.request(`${base}/1`, { ...json(patch), method: 'PATCH' })
    expect(res.status).toBe(404)
  })

  it('PATCH updates and returns 200', async () => {
    m().update.mockResolvedValue({ id: 1, ...patch })
    const res = await app.request(`${base}/1`, { ...json(patch), method: 'PATCH' })
    expect(res.status).toBe(200)
    expect(m().update).toHaveBeenCalledWith({ where: { [key === 'bitingPreference' ? 'fishId' : 'id']: 1 }, data: patch })
  })

  it('DELETE removes and returns 204', async () => {
    m().delete.mockResolvedValue({})
    const res = await app.request(`${base}/1`, { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('DELETE returns 404 when the target is missing', async () => {
    m().delete.mockRejectedValue(P2025)
    const res = await app.request(`${base}/1`, { method: 'DELETE' })
    expect(res.status).toBe(404)
  })

  it('DELETE rejects a non-numeric id with 400', async () => {
    const res = await app.request(`${base}/abc`, { method: 'DELETE' })
    expect(res.status).toBe(400)
    expect(m().delete).not.toHaveBeenCalled()
  })
})

// fish-locations is the composite-key exception: no id path param, rows are
// addressed via ?fishId=&locationId=&specificSpot= query params.
describe('fish-locations CRUD', () => {
  const m = () => prisma.fishLocation
  const key = { fishId: 1, locationId: 2, specificSpot: 'General' }

  it('GET list filters by fishId/locationId', async () => {
    m().findMany.mockResolvedValue([])
    const res = await app.request('/api/fish-locations?fishId=1&locationId=2')
    expect(res.status).toBe(200)
    expect(m().findMany).toHaveBeenCalledWith({
      where: { fishId: 1, locationId: 2 },
      orderBy: [{ fishId: 'asc' }, { locationId: 'asc' }],
    })
  })

  it('POST creates with only whitelisted fields and returns 201', async () => {
    m().create.mockResolvedValue({ ...key, classesPresent: ['Trophy'] })
    const res = await app.request('/api/fish-locations', json({ ...key, classesPresent: ['Trophy'], bogus: 'nope' }))
    expect(res.status).toBe(201)
    expect(m().create).toHaveBeenCalledWith({ data: { ...key, classesPresent: ['Trophy'] } })
  })

  it('PATCH without key query params returns 400', async () => {
    const res = await app.request('/api/fish-locations', { ...json({ classesPresent: ['A'] }), method: 'PATCH' })
    expect(res.status).toBe(400)
    expect(m().update).not.toHaveBeenCalled()
  })

  it('PATCH updates the composite-keyed row and returns 200', async () => {
    m().update.mockResolvedValue({ ...key, classesPresent: ['A'] })
    const res = await app.request(
      '/api/fish-locations?fishId=1&locationId=2&specificSpot=General',
      { ...json({ classesPresent: ['A'], bogus: 'nope' }), method: 'PATCH' },
    )
    expect(res.status).toBe(200)
    expect(m().update).toHaveBeenCalledWith({
      where: { fishId_locationId_specificSpot: key },
      data: { classesPresent: ['A'] },
    })
  })

  it('PATCH returns 404 when the target is missing', async () => {
    m().update.mockRejectedValue(P2025)
    const res = await app.request(
      '/api/fish-locations?fishId=1&locationId=2&specificSpot=General',
      { ...json({ classesPresent: ['A'] }), method: 'PATCH' },
    )
    expect(res.status).toBe(404)
  })

  it('DELETE without key query params returns 400', async () => {
    const res = await app.request('/api/fish-locations', { method: 'DELETE' })
    expect(res.status).toBe(400)
    expect(m().delete).not.toHaveBeenCalled()
  })

  it('DELETE removes the composite-keyed row and returns 204', async () => {
    m().delete.mockResolvedValue({})
    const res = await app.request(
      '/api/fish-locations?fishId=1&locationId=2&specificSpot=General',
      { method: 'DELETE' },
    )
    expect(res.status).toBe(204)
    expect(m().delete).toHaveBeenCalledWith({ where: { fishId_locationId_specificSpot: key } })
  })

  it('DELETE returns 404 when the target is missing', async () => {
    m().delete.mockRejectedValue(P2025)
    const res = await app.request(
      '/api/fish-locations?fishId=1&locationId=2&specificSpot=General',
      { method: 'DELETE' },
    )
    expect(res.status).toBe(404)
  })
})
