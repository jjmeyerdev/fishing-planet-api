import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { rateLimit } from '../src/rateLimit.js'
import { apiKeyAuth } from '../src/auth.js'
import { log, requestLogger, type LogEnv } from '../src/logger.js'

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

// The id-in-path resources are structurally identical CRUD wrappers (the tackle
// resources below share a single crudResource() factory).
type Key =
  | 'fish'
  | 'location'
  | 'bitingPreference'
  | 'bait'
  | 'boilie'
  | 'lureType'
  | 'lure'
  | 'hook'
  | 'jighead'
  | 'sinker'
  | 'keepnet'
  | 'addon'
  | 'spot'
  | 'weather'
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
  {
    label: 'baits',
    base: '/api/baits',
    key: 'bait',
    create: { fpId: 1, title: 'Worm', slug: 'worm', baitType: 'Live Baits' },
    junk: { id: 999, bogus: 'nope' },
    patch: { baseLevel: 5 },
  },
  {
    label: 'boilies',
    base: '/api/boilies',
    key: 'boilie',
    create: { fpId: 2, title: 'Banana Boilie', slug: 'banana-boilie', baitType: 'Boilies' },
    junk: { id: 999, bogus: 'nope' },
    patch: { diameterMm: 12 },
  },
  {
    label: 'lure-types',
    base: '/api/lure-types',
    key: 'lureType',
    create: { fpId: 3, title: 'Slop Spoons', slug: 'slop-spoons' },
    junk: { id: 999, bogus: 'nope' },
    patch: { title: 'Spoons' },
  },
  {
    label: 'lures',
    base: '/api/lures',
    key: 'lure',
    create: { fpId: 4, title: 'Slop Spoon 5 g', slug: 'slop-spoon-5-g' },
    junk: { id: 999, bogus: 'nope' },
    patch: { color: 'Gold' },
  },
  {
    label: 'hooks',
    base: '/api/hooks',
    key: 'hook',
    create: { fpId: 5, title: 'Hook #10', slug: 'hook-10', size: '#10', type: 'kirby' },
    junk: { id: 999, bogus: 'nope' },
    patch: { baseLevel: 2 },
  },
  {
    label: 'jigheads',
    base: '/api/jigheads',
    key: 'jighead',
    create: { fpId: 6, title: 'JigHead 5 g', slug: 'jighead-5-g', size: '#2' },
    junk: { id: 999, bogus: 'nope' },
    patch: { color: 'Red' },
  },
  {
    label: 'sinkers',
    base: '/api/sinkers',
    key: 'sinker',
    create: { fpId: 7, title: 'Drop Sinker 2 g', slug: 'drop-sinker-2-g', form: 'Drop' },
    junk: { id: 999, bogus: 'nope' },
    patch: { color: 'Black' },
  },
  {
    label: 'keepnets',
    base: '/api/keepnets',
    key: 'keepnet',
    create: { fpId: 8, title: 'FishHut XS', slug: 'fishhut-xs', type: 'Keepnet', isFishFriendly: true },
    junk: { id: 999, bogus: 'nope' },
    patch: { baseLevel: 1 },
  },
  {
    label: 'addons',
    base: '/api/addons',
    key: 'addon',
    create: { fpId: 9, title: 'Torch Flashlight', slug: 'torch-flashlight' },
    junk: { id: 999, bogus: 'nope' },
    patch: { color: 'Red' },
  },
  {
    label: 'spots',
    base: '/api/spots',
    key: 'spot',
    create: { fpId: 10, name: 'Skarvika', slug: 'norway-skarvika', title: 'Norway - Skarvika', lat: '-1706.495', lng: '2469.965', x: '49.3993', y: '34.1299', locationId: 1 },
    junk: { id: 999, bogus: 'nope' },
    patch: { title: 'Norway - Renamed' },
  },
  {
    label: 'weathers',
    base: '/api/weathers',
    key: 'weather',
    create: { fpId: 11, name: 'Cloudy', slug: 'norway-day-cloudy', title: 'Norway - Day - Cloudy', value: 'cloudy', legacyValue: 'cloudy', type: 'day', locationId: 1 },
    junk: { id: 999, bogus: 'nope' },
    patch: { type: 'night' },
  },
]

describe.each(RESOURCES)('$label CRUD', ({ base, key, create, junk, patch }) => {
  const m = () => prisma[key]

  it('GET list returns a paginated envelope with defaults', async () => {
    m().findMany.mockResolvedValue([{ id: 1 }])
    m().count.mockResolvedValue(1)
    const res = await app.request(base)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [{ id: 1 }], total: 1, limit: 50, offset: 0 })
    expect(m().findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }))
  })

  it('GET list honors ?limit=&offset=', async () => {
    m().findMany.mockResolvedValue([])
    m().count.mockResolvedValue(0)
    const res = await app.request(`${base}?limit=2&offset=4`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [], total: 0, limit: 2, offset: 4 })
    expect(m().findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 4, take: 2 }))
  })

  it('GET list rejects out-of-range/invalid pagination with 400', async () => {
    for (const q of ['limit=0', 'limit=101', 'offset=-1', 'limit=abc']) {
      const res = await app.request(`${base}?${q}`)
      expect(res.status, q).toBe(400)
    }
    expect(m().findMany).not.toHaveBeenCalled()
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

  it('POST rejects a malformed JSON body with 400', async () => {
    const res = await app.request(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    })
    expect(res.status).toBe(400)
    expect(m().create).not.toHaveBeenCalled()
  })

  it('POST rejects a non-object JSON body with 400', async () => {
    const res = await app.request(base, json(42))
    expect(res.status).toBe(400)
    expect(m().create).not.toHaveBeenCalled()
  })

  it('POST returns 409 on a unique-constraint violation', async () => {
    m().create.mockRejectedValue({ code: 'P2002' })
    const res = await app.request(base, json(create))
    expect(res.status).toBe(409)
  })

  it('POST returns 400 when Prisma rejects the data as invalid', async () => {
    m().create.mockRejectedValue(Object.assign(new Error('bad'), { name: 'PrismaClientValidationError' }))
    const res = await app.request(base, json(create))
    expect(res.status).toBe(400)
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

  it('POST rejects a malformed JSON body with 400', async () => {
    const res = await app.request('/api/fish-locations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    })
    expect(res.status).toBe(400)
    expect(m().create).not.toHaveBeenCalled()
  })

  it('GET list filters by fishId/locationId and paginates', async () => {
    m().findMany.mockResolvedValue([])
    m().count.mockResolvedValue(0)
    const res = await app.request('/api/fish-locations?fishId=1&locationId=2')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [], total: 0, limit: 50, offset: 0 })
    expect(m().findMany).toHaveBeenCalledWith({
      where: { fishId: 1, locationId: 2 },
      orderBy: [{ fishId: 'asc' }, { locationId: 'asc' }],
      skip: 0,
      take: 50,
    })
    expect(m().count).toHaveBeenCalledWith({ where: { fishId: 1, locationId: 2 } })
  })

  it('GET list rejects a non-numeric fishId filter with 400', async () => {
    const res = await app.request('/api/fish-locations?fishId=abc')
    expect(res.status).toBe(400)
    expect(m().findMany).not.toHaveBeenCalled()
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

describe('error handling', () => {
  it('does not leak the internal error message on a 500', async () => {
    prisma.fish.create.mockRejectedValue(new Error('sensitive db detail'))
    const res = await app.request('/api/fish', json({ commonName: 'X' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'Internal server error' })
    expect(JSON.stringify(body)).not.toContain('sensitive db detail')
  })
})

describe('list filtering', () => {
  it('fish ?q= builds a case-insensitive commonName search, applied to both queries', async () => {
    prisma.fish.findMany.mockResolvedValue([])
    prisma.fish.count.mockResolvedValue(0)
    const res = await app.request('/api/fish?q=bass')
    expect(res.status).toBe(200)
    const where = { commonName: { contains: 'bass', mode: 'insensitive' } }
    expect(prisma.fish.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }))
    expect(prisma.fish.count).toHaveBeenCalledWith({ where })
  })

  it('fish combines a boolean and an exact string filter', async () => {
    prisma.fish.findMany.mockResolvedValue([])
    prisma.fish.count.mockResolvedValue(0)
    const res = await app.request('/api/fish?isMonster=true&family=Centrarchidae')
    expect(res.status).toBe(200)
    expect(prisma.fish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isMonster: true, family: 'Centrarchidae' } }),
    )
  })

  it('fish rejects a non-boolean filter with 400', async () => {
    const res = await app.request('/api/fish?isMonster=maybe')
    expect(res.status).toBe(400)
    expect(prisma.fish.findMany).not.toHaveBeenCalled()
  })

  it('locations rejects a non-integer unlockLevel filter with 400', async () => {
    const res = await app.request('/api/locations?unlockLevel=abc')
    expect(res.status).toBe(400)
    expect(prisma.location.findMany).not.toHaveBeenCalled()
  })

  it('ignores unknown query params so filters coexist with pagination', async () => {
    prisma.fish.findMany.mockResolvedValue([])
    prisma.fish.count.mockResolvedValue(0)
    const res = await app.request('/api/fish?bogus=1&limit=5')
    expect(res.status).toBe(200)
    expect(prisma.fish.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, take: 5 }))
  })
})

describe('list sorting', () => {
  it('defaults to id asc when no sort is given', async () => {
    prisma.fish.findMany.mockResolvedValue([])
    prisma.fish.count.mockResolvedValue(0)
    await app.request('/api/fish')
    expect(prisma.fish.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: 'asc' } }))
  })

  it('sorts by a whitelisted field and direction', async () => {
    prisma.fish.findMany.mockResolvedValue([])
    prisma.fish.count.mockResolvedValue(0)
    const res = await app.request('/api/fish?sort=commonName&order=desc')
    expect(res.status).toBe(200)
    expect(prisma.fish.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { commonName: 'desc' } }))
  })

  it('defaults order to asc when only sort is given', async () => {
    prisma.fish.findMany.mockResolvedValue([])
    prisma.fish.count.mockResolvedValue(0)
    await app.request('/api/fish?sort=family')
    expect(prisma.fish.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { family: 'asc' } }))
  })

  it('rejects a non-whitelisted sort field with 400', async () => {
    const res = await app.request('/api/fish?sort=description')
    expect(res.status).toBe(400)
    expect(prisma.fish.findMany).not.toHaveBeenCalled()
  })

  it('rejects an invalid order value with 400', async () => {
    const res = await app.request('/api/fish?sort=commonName&order=sideways')
    expect(res.status).toBe(400)
    expect(prisma.fish.findMany).not.toHaveBeenCalled()
  })
})

describe('readiness and DB resilience', () => {
  it('GET /ready returns 200 when the DB responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ ok: 1 }])
    const res = await app.request('/ready')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ready' })
  })

  it('GET /ready returns 503 when the DB is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'))
    const res = await app.request('/ready')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'unavailable' })
  })

  it('GET /health does not touch the DB (liveness only)', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('maps a Prisma connection error to 503, not 500', async () => {
    prisma.fish.findMany.mockRejectedValue(Object.assign(new Error("Can't reach database"), { code: 'P1001' }))
    const res = await app.request('/api/fish')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Database unavailable' })
  })
})

describe('get-by-name lookup', () => {
  it('GET /api/fish/by-name/:name returns the fish (URL-decoded, with biting preference)', async () => {
    prisma.fish.findUnique.mockResolvedValue({ id: 1, commonName: 'Largemouth Bass' })
    const res = await app.request('/api/fish/by-name/Largemouth%20Bass')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 1, commonName: 'Largemouth Bass' })
    expect(prisma.fish.findUnique).toHaveBeenCalledWith({
      where: { commonName: 'Largemouth Bass' },
      include: {
        bitingPreference: true,
        baits: { include: { bait: true } },
        lureTypes: { include: { lureType: true } },
      },
    })
  })

  it('GET /api/fish/by-name/:name returns 404 when missing', async () => {
    prisma.fish.findUnique.mockResolvedValue(null)
    const res = await app.request('/api/fish/by-name/Nope')
    expect(res.status).toBe(404)
  })

  it('GET /api/locations/by-name/:name returns the location', async () => {
    prisma.location.findUnique.mockResolvedValue({ id: 2, name: 'Emerald Lake' })
    const res = await app.request('/api/locations/by-name/Emerald%20Lake')
    expect(res.status).toBe(200)
    expect(prisma.location.findUnique).toHaveBeenCalledWith({ where: { name: 'Emerald Lake' } })
  })

  it('GET /api/locations/by-name/:name returns 404 when missing', async () => {
    prisma.location.findUnique.mockResolvedValue(null)
    const res = await app.request('/api/locations/by-name/Nope')
    expect(res.status).toBe(404)
  })
})

describe('rate limiting', () => {
  const build = (max: number) => {
    const a = new Hono()
    a.use('*', rateLimit({ max, windowMs: 60_000 }))
    a.get('/', (c) => c.text('ok'))
    return a
  }

  it('allows up to max, then returns 429 with Retry-After', async () => {
    const a = build(2)
    expect((await a.request('/')).status).toBe(200)
    expect((await a.request('/')).status).toBe(200)
    const blocked = await a.request('/')
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
    expect(await blocked.json()).toEqual({ error: 'Too many requests' })
  })

  it('sets RateLimit headers on allowed responses', async () => {
    const res = await build(5).request('/')
    expect(res.headers.get('RateLimit-Limit')).toBe('5')
    expect(res.headers.get('RateLimit-Remaining')).toBe('4')
  })

  it('is disabled when max <= 0', async () => {
    const a = build(0)
    for (let i = 0; i < 10; i++) expect((await a.request('/')).status).toBe(200)
  })
})

describe('api-key auth (writes)', () => {
  const build = (keys: string[]) => {
    const a = new Hono()
    a.use('/api/*', apiKeyAuth({ keys }))
    a.get('/api/x', (c) => c.text('read'))
    a.post('/api/x', (c) => c.text('write'))
    return a
  }

  it('allows reads without a key', async () => {
    expect((await build(['k1']).request('/api/x')).status).toBe(200)
  })

  it('rejects writes without a key (401 + WWW-Authenticate)', async () => {
    const res = await build(['k1']).request('/api/x', { method: 'POST' })
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('allows writes with a valid Bearer key', async () => {
    const res = await build(['k1', 'k2']).request('/api/x', { method: 'POST', headers: { authorization: 'Bearer k2' } })
    expect(res.status).toBe(200)
  })

  it('rejects writes with a wrong key', async () => {
    const res = await build(['k1']).request('/api/x', { method: 'POST', headers: { authorization: 'Bearer nope' } })
    expect(res.status).toBe(401)
  })

  it('is disabled (writes open) when no keys are configured', async () => {
    expect((await build([]).request('/api/x', { method: 'POST' })).status).toBe(200)
  })
})

describe('structured logging', () => {
  const build = () => {
    const a = new Hono<LogEnv>()
    a.use('*', requestLogger())
    a.get('/', (c) => c.text('ok'))
    return a
  }

  it('sets an X-Request-Id response header', async () => {
    const res = await build().request('/')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('echoes an incoming X-Request-Id', async () => {
    const res = await build().request('/', { headers: { 'x-request-id': 'trace-123' } })
    expect(res.headers.get('x-request-id')).toBe('trace-123')
  })

  it('log() emits a single JSON line with level/time/msg and fields', async () => {
    vi.stubEnv('LOG_SILENT', '')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    log('info', 'hello', { path: '/x', status: 200 })
    expect(spy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed).toMatchObject({ level: 'info', msg: 'hello', path: '/x', status: 200 })
    expect(typeof parsed.time).toBe('string')
    spy.mockRestore()
    vi.unstubAllEnvs()
  })

  it('log() is suppressed when LOG_SILENT is set', async () => {
    vi.stubEnv('LOG_SILENT', '1')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    log('info', 'quiet')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    vi.unstubAllEnvs()
  })

  it('does not emit a request line when the handler errored (onError logs it)', async () => {
    vi.stubEnv('LOG_SILENT', '')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const a = new Hono<LogEnv>()
    a.use('*', requestLogger())
    a.get('/boom', () => { throw new HTTPException(400, { message: 'bad' }) })
    a.onError((e, c) => c.json({ error: (e as Error).message }, 400))
    await a.request('/boom')
    const requestLines = spy.mock.calls.filter((call) => String(call[0]).includes('"msg":"request"'))
    expect(requestLines).toHaveLength(0)
    spy.mockRestore()
    vi.unstubAllEnvs()
  })
})

describe('metrics', () => {
  it('GET /metrics exposes Prometheus text incl. default process/runtime metrics', async () => {
    const res = await app.request('/metrics')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const body = await res.text()
    expect(body).toContain('http_requests_total')
    expect(body).toContain('http_request_duration_seconds')
    expect(body).toContain('nodejs_') // default runtime metrics collected
    expect(body).toContain('process_cpu')
  })

  it('records a request labeled by the matched route pattern', async () => {
    prisma.fish.findMany.mockResolvedValue([])
    prisma.fish.count.mockResolvedValue(0)
    await app.request('/api/fish')
    const body = await (await app.request('/metrics')).text()
    expect(body).toContain('route="/api/fish"')
  })
})

describe('API docs', () => {
  it('GET /docs serves Swagger UI HTML pointing at the spec', async () => {
    const res = await app.request('/docs')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('swagger-ui')
    expect(html).toContain('/openapi.yaml')
  })

  it('GET /openapi.yaml serves the spec document', async () => {
    const res = await app.request('/openapi.yaml')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('yaml')
    const body = await res.text()
    expect(body).toContain('openapi:')
    expect(body).toContain('fishing-planet-api')
  })
})

// The wiki_* read routes are a separate read-only factory (list + by-slug detail,
// no writes), mounted under /api/wiki.
describe('wiki read routes', () => {
  const reel = () => prisma.wikiReel

  it('GET list returns a paginated envelope and forwards where/orderBy', async () => {
    reel().findMany.mockResolvedValue([{ id: 1, slug: 'x' }])
    reel().count.mockResolvedValue(1)
    const res = await app.request('/api/wiki/reels?q=magfin&subtype=casting&sort=name&order=desc&limit=5')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [{ id: 1, slug: 'x' }], total: 1, limit: 5, offset: 0 })
    expect(reel().findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: 'magfin', mode: 'insensitive' }, subtype: 'casting' },
        orderBy: { name: 'desc' },
        skip: 0,
        take: 5,
      }),
    )
  })

  it('GET list defaults to id asc with no filters', async () => {
    reel().findMany.mockResolvedValue([])
    reel().count.mockResolvedValue(0)
    await app.request('/api/wiki/reels')
    expect(reel().findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, orderBy: { id: 'asc' } }))
  })

  it('GET by-slug returns the row with its configured include', async () => {
    reel().findUnique.mockResolvedValue({ id: 1, slug: 'casting-x' })
    const res = await app.request('/api/wiki/reels/casting-x')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 1, slug: 'casting-x' })
    expect(reel().findUnique).toHaveBeenCalledWith({
      where: { slug: 'casting-x' },
      include: { brand: true, variants: true, technologies: { include: { technology: true } } },
    })
  })

  it('GET by-slug returns 404 when missing', async () => {
    reel().findUnique.mockResolvedValue(null)
    expect((await app.request('/api/wiki/reels/nope')).status).toBe(404)
  })

  it('rejects a bad sort field with 400 before querying', async () => {
    expect((await app.request('/api/wiki/reels?sort=bogus')).status).toBe(400)
    expect(reel().findMany).not.toHaveBeenCalled()
  })

  it('bobbers detail passes no include (flat table)', async () => {
    prisma.wikiBobber.findUnique.mockResolvedValue({ id: 1 })
    await app.request('/api/wiki/bobbers/some-slug')
    expect(prisma.wikiBobber.findUnique).toHaveBeenCalledWith({ where: { slug: 'some-slug' } })
  })

  it('species list filters by family', async () => {
    prisma.wikiSpecies.findMany.mockResolvedValue([])
    prisma.wikiSpecies.count.mockResolvedValue(0)
    await app.request('/api/wiki/species?family=Carp')
    expect(prisma.wikiSpecies.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { family: 'Carp' } }))
  })

  it('exposes no write routes (POST is unmatched → 404)', async () => {
    const res = await app.request('/api/wiki/reels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(res.status).toBe(404)
    expect(reel().create).not.toHaveBeenCalled()
  })

  it('flat consumable resources list + fetch by slug', async () => {
    prisma.wikiBait.findMany.mockResolvedValue([{ id: 1, slug: 'b' }])
    prisma.wikiBait.count.mockResolvedValue(1)
    const list = await app.request('/api/wiki/baits')
    expect(list.status).toBe(200)
    expect((await list.json()).total).toBe(1)
    prisma.wikiBait.findUnique.mockResolvedValue({ id: 1, slug: 'common-baits-bread' })
    const one = await app.request('/api/wiki/baits/common-baits-bread')
    expect(one.status).toBe(200)
    expect(prisma.wikiBait.findUnique).toHaveBeenCalledWith({ where: { slug: 'common-baits-bread' } })
  })

  it('technologies list filters by category; brands sort has no subtype', async () => {
    prisma.wikiTechnology.findMany.mockResolvedValue([])
    prisma.wikiTechnology.count.mockResolvedValue(0)
    await app.request('/api/wiki/technologies?category=rod')
    expect(prisma.wikiTechnology.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { category: 'rod' } }))
    // `subtype` isn't a brands filter, so it's ignored (coexists with pagination)
    prisma.wikiBrand.findMany.mockResolvedValue([])
    prisma.wikiBrand.count.mockResolvedValue(0)
    await app.request('/api/wiki/brands?subtype=whatever')
    expect(prisma.wikiBrand.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})

describe('wiki cross-category search', () => {
  const WIKI_MODELS = [
    'wikiSpecies', 'wikiReel', 'wikiRod', 'wikiLine', 'wikiHook', 'wikiSinker', 'wikiBobber', 'wikiLure',
    'wikiBait', 'wikiBoilie', 'wikiGroundbait', 'wikiEquipment', 'wikiTransport', 'wikiOther', 'wikiRig', 'wikiBrand', 'wikiTechnology',
  ] as const
  beforeEach(() => {
    for (const k of WIKI_MODELS) prisma[k].findMany.mockResolvedValue([])
  })

  it('requires q (400 without it)', async () => {
    expect((await app.request('/api/wiki/search')).status).toBe(400)
    expect(prisma.wikiReel.findMany).not.toHaveBeenCalled()
  })

  it('fans out across categories and returns tagged hits grouped by category', async () => {
    prisma.wikiSpecies.findMany.mockResolvedValue([{ name: 'Largemouth Bass', slug: 'lmb', imageUrl: 'i' }])
    prisma.wikiReel.findMany.mockResolvedValue([{ name: 'BassShooter', slug: 'bs', subtype: 'casting' }])
    const res = await app.request('/api/wiki/search?q=bass')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      query: 'bass',
      limit: 8,
      total: 2,
      results: [
        { category: 'species', name: 'Largemouth Bass', slug: 'lmb', imageUrl: 'i' },
        { category: 'reels', name: 'BassShooter', slug: 'bs', subtype: 'casting' },
      ],
    })
    expect(prisma.wikiBait.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { contains: 'bass', mode: 'insensitive' } }, take: 8 }),
    )
  })

  it('rejects out-of-range limit and unknown category with 400', async () => {
    expect((await app.request('/api/wiki/search?q=x&limit=99')).status).toBe(400)
    expect((await app.request('/api/wiki/search?q=x&category=bogus')).status).toBe(400)
    expect(prisma.wikiReel.findMany).not.toHaveBeenCalled()
  })

  it('category= narrows the fan-out to the named categories', async () => {
    await app.request('/api/wiki/search?q=carp&category=species,baits')
    expect(prisma.wikiSpecies.findMany).toHaveBeenCalled()
    expect(prisma.wikiBait.findMany).toHaveBeenCalled()
    expect(prisma.wikiReel.findMany).not.toHaveBeenCalled()
  })
})
