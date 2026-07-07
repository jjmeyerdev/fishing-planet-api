import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db.js'
import { pageParams } from '../helpers.js'

// Cross-category search over the wiki_* dataset: a case-insensitive substring
// match on `name`, fanned out across every category, returning one flat list of
// category-tagged hits (grouped by category, then by name). Each hit carries just
// enough to link to its detail route (`/api/wiki/<category>/<slug>`); `subtype`
// and `imageUrl` are included only for the categories that have them.

interface SearchTarget {
  category: string
  model: {
    findMany(args: unknown): Promise<unknown[]>
    count(args: unknown): Promise<number>
  }
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

function hit(category: string, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { category, name: row.name, slug: row.slug }
  if (row.subtype != null) out.subtype = row.subtype
  if (row.imageUrl != null) out.imageUrl = row.imageUrl
  return out
}

// GET /api/wiki/search?q=&limit=&offset=&category=
export async function wikiSearch(c: Context): Promise<Response> {
  const q = c.req.query('q')?.trim()
  if (!q) throw new HTTPException(400, { message: 'q (search term) is required' })

  const { limit, offset } = pageParams(c)

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

  // True total across every target category (cheap parallel counts).
  const counts = await Promise.all(targets.map((t) => t.model.count({ where })))
  const total = counts.reduce((sum, n) => sum + n, 0)

  // The flat list concatenates the categories in TARGETS order, each sorted by
  // name. Walk them and query only the categories the [offset, offset+limit)
  // window actually spans, so the DB fetch stays bounded to one page.
  const results: Record<string, unknown>[] = []
  let seen = 0 // absolute index of the current category's first row
  for (const [i, t] of targets.entries()) {
    if (results.length >= limit) break
    const n = counts[i]
    if (n === 0) continue
    const skip = offset - seen // window start relative to this category
    seen += n
    if (skip >= n) continue // this whole category precedes the window
    const rows = (await t.model.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: Math.max(0, skip),
      take: limit - results.length,
    })) as Record<string, unknown>[]
    for (const r of rows) results.push(hit(t.category, r))
  }

  return c.json({ query: q, total, limit, offset, results })
}
