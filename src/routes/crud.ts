import { Hono } from 'hono'
import { readJson, pick, intParam, pageParams, buildWhere, sortOrder, orClientError } from './helpers.js'
import type { FilterSpec } from './helpers.js'

// The subset of a Prisma model delegate the generic CRUD routes call. Method
// syntax (not arrow properties) keeps the parameters bivariant so a real,
// specifically-typed Prisma delegate stays assignable to this shape.
export interface CrudModel {
  findMany(args: unknown): Promise<unknown[]>
  count(args: unknown): Promise<number>
  findUnique(args: unknown): Promise<unknown>
  create(args: unknown): Promise<unknown>
  update(args: unknown): Promise<unknown>
  delete(args: unknown): Promise<unknown>
}

export interface CrudConfig {
  model: CrudModel
  fields: readonly string[]
  filters: readonly FilterSpec[]
  sortable: readonly string[]
}

// Build the standard id-in-path CRUD router (paginated/filtered/sorted list,
// get-one, create, update, delete) shared by the uniform tackle resources. The
// bespoke resources (fish, locations, fish-locations, biting-preferences) keep
// their own hand-written routers for their per-resource quirks.
export function crudResource({ model, fields, filters, sortable }: CrudConfig): Hono {
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

  r.get('/:id', async (c) => {
    const id = intParam(c, 'id')
    const row = await model.findUnique({ where: { id } })
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  })

  r.post('/', async (c) => {
    const body = await readJson(c)
    const created = await orClientError(model.create({ data: pick(body, fields) }))
    return c.json(created, 201)
  })

  r.patch('/:id', async (c) => {
    const id = intParam(c, 'id')
    const body = await readJson(c)
    const updated = await orClientError(model.update({ where: { id }, data: pick(body, fields) }))
    return c.json(updated)
  })

  r.delete('/:id', async (c) => {
    const id = intParam(c, 'id')
    await orClientError(model.delete({ where: { id } }))
    return c.body(null, 204)
  })

  return r
}
