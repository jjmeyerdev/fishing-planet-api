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

  // Fetch, per category in parallel, just enough to cover the page plus one row
  // to detect further results. The categories concatenate in TARGETS order (each
  // name-sorted), so slicing the merged list yields the cross-category page. We
  // deliberately fetch with a bounded `take` and no count() fan-out: a per-
  // category count() over the unindexed `name ILIKE '%q%'` is a full scan, and
  // 17 of them in parallel exhausted the serverless pool (connection-timeout
  // 500s in production). A true cross-category total needs those counts, so we
  // report `hasMore` instead.
  const cap = offset + limit
  const groups = await Promise.all(
    targets.map(async (t) => {
      const rows = (await t.model.findMany({ where, take: cap + 1, orderBy: { name: 'asc' } })) as Record<string, unknown>[]
      return rows.map((r) => hit(t.category, r))
    }),
  )
  const merged = groups.flat()
  const results = merged.slice(offset, cap)
  const hasMore = merged.length > cap
  return c.json({ query: q, limit, offset, hasMore, results })
}
