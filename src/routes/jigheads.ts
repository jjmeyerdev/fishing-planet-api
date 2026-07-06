import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'title', kind: 'search' },
  { param: 'size', field: 'size', kind: 'string' },
  { param: 'color', field: 'color', kind: 'string' },
  { param: 'baseLevel', field: 'baseLevel', kind: 'int' },
]

export const jigheads = crudResource({
  model: prisma.jighead,
  fields: ['fpId', 'title', 'slug', 'imageUrl', 'baseLevel', 'baitcoinLevel', 'size', 'weightG', 'color', 'tags'],
  filters: FILTERS,
  sortable: ['id', 'title', 'baseLevel', 'baitcoinLevel', 'weightG'],
})
