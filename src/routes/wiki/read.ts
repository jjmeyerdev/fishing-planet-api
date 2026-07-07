import { Hono } from 'hono'
import { pageParams, buildWhere, sortOrder } from '../helpers.js'
import type { FilterSpec } from '../helpers.js'

// Read-only counterpart to `crudResource` for the load-only `wiki_*` dataset: a
// paginated/filtered/sorted list plus a by-slug detail (with optional relation
// embedding). No write routes — the wiki tables are populated only by `wiki:load`,
// so POST/PATCH/DELETE would be meaningless.

// The subset of a Prisma model delegate these routes call. Method syntax (not
// arrow properties) keeps the parameters bivariant so a specifically-typed Prisma
// delegate stays assignable to this shape (same trick as `CrudModel`).
export interface ReadModel {
  findMany(args: unknown): Promise<unknown[]>
  count(args: unknown): Promise<number>
  findUnique(args: unknown): Promise<unknown>
}

export interface ReadConfig {
  model: ReadModel
  filters: readonly FilterSpec[]
  sortable: readonly string[]
  include?: unknown // Prisma `include` for the by-slug detail response
}

export function readResource({ model, filters, sortable, include }: ReadConfig): Hono {
  const r = new Hono()

  r.get('/', async (c) => {
    const { limit, offset } = pageParams(c)
    const where = buildWhere(c, filters)
    const orderBy = sortOrder(c, sortable) ?? { id: 'asc' }
    const [data, total] = await Promise.all([
      model.findMany({ where, orderBy, skip: offset, take: limit }),
      model.count({ where }),
    ])
    return c.json({ data, total, limit, offset })
  })

  r.get('/:slug', async (c) => {
    const row = await model.findUnique({ where: { slug: c.req.param('slug') }, ...(include ? { include } : {}) })
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  })

  return r
}
