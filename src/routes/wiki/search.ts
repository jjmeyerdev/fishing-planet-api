import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db.js'
import { intQuery } from '../helpers.js'

// Cross-category search over the wiki_* dataset: a case-insensitive substring
// match on `name`, fanned out across every category, returning one flat list of
// category-tagged hits (grouped by category, then by name). Each hit carries just
// enough to link to its detail route (`/api/wiki/<category>/<slug>`); `subtype`
// and `imageUrl` are included only for the categories that have them.

interface SearchTarget {
  category: string
  model: { findMany(args: unknown): Promise<unknown[]> }
}

const TARGETS: SearchTarget[] = [
  { category: 'species', model: prisma.wikiSpecies },
  { category: 'reels', model: prisma.wikiReel },
  { category: 'rods', model: prisma.wikiRod },
  { category: 'lines', model: prisma.wikiLine },
  { category: 'hooks', model: prisma.wikiHook },
  { category: 'sinkers', model: prisma.wikiSinker },
  { category: 'bobbers', model: prisma.wikiBobber },
  { category: 'lures', model: prisma.wikiLure },
  { category: 'baits', model: prisma.wikiBait },
  { category: 'boilies', model: prisma.wikiBoilie },
  { category: 'groundbaits', model: prisma.wikiGroundbait },
  { category: 'equipment', model: prisma.wikiEquipment },
  { category: 'transport', model: prisma.wikiTransport },
  { category: 'other', model: prisma.wikiOther },
  { category: 'rigs', model: prisma.wikiRig },
  { category: 'brands', model: prisma.wikiBrand },
  { category: 'technologies', model: prisma.wikiTechnology },
]

const CATEGORIES = new Set(TARGETS.map((t) => t.category))
const MAX_PER_CATEGORY = 25
const DEFAULT_PER_CATEGORY = 8

function hit(category: string, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { category, name: row.name, slug: row.slug }
  if (row.subtype != null) out.subtype = row.subtype
  if (row.imageUrl != null) out.imageUrl = row.imageUrl
  return out
}

// GET /api/wiki/search?q=&limit=&category=
export async function wikiSearch(c: Context): Promise<Response> {
  const q = c.req.query('q')?.trim()
  if (!q) throw new HTTPException(400, { message: 'q (search term) is required' })

  const perCategory = intQuery(c, 'limit') ?? DEFAULT_PER_CATEGORY
  if (perCategory < 1 || perCategory > MAX_PER_CATEGORY) {
    throw new HTTPException(400, { message: `limit must be between 1 and ${MAX_PER_CATEGORY}` })
  }

  // Optional ?category= (comma-separated) narrows the fan-out; unknown names 400.
  const raw = c.req.query('category')
  let targets = TARGETS
  if (raw) {
    const requested = raw.split(',').map((s) => s.trim()).filter(Boolean)
    const unknown = requested.find((name) => !CATEGORIES.has(name))
    if (unknown) throw new HTTPException(400, { message: `Unknown category: ${unknown}` })
    targets = TARGETS.filter((t) => requested.includes(t.category))
  }

  const where = { name: { contains: q, mode: 'insensitive' } }
  const groups = await Promise.all(
    targets.map(async (t) => {
      const rows = (await t.model.findMany({ where, take: perCategory, orderBy: { name: 'asc' } })) as Record<string, unknown>[]
      return rows.map((r) => hit(t.category, r))
    }),
  )
  const results = groups.flat()
  return c.json({ query: q, limit: perCategory, total: results.length, results })
}
