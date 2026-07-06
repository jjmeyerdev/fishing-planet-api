import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'title', kind: 'search' },
  { param: 'type', field: 'type', kind: 'string' },
  { param: 'size', field: 'size', kind: 'string' },
  { param: 'baseLevel', field: 'baseLevel', kind: 'int' },
]

export const hooks = crudResource({
  model: prisma.hook,
  fields: ['fpId', 'title', 'slug', 'imageUrl', 'baseLevel', 'baitcoinLevel', 'size', 'type', 'tags'],
  filters: FILTERS,
  sortable: ['id', 'title', 'baseLevel', 'baitcoinLevel'],
})
