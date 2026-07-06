import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'title', kind: 'search' },
  { param: 'color', field: 'color', kind: 'string' },
  { param: 'lureTypeId', field: 'lureTypeId', kind: 'int' },
  { param: 'baseLevel', field: 'baseLevel', kind: 'int' },
]

export const lures = crudResource({
  model: prisma.lure,
  fields: ['fpId', 'title', 'slug', 'imageUrl', 'baseLevel', 'baitcoinLevel', 'color', 'weightG', 'lengthCm', 'tags', 'lureTypeId'],
  filters: FILTERS,
  sortable: ['id', 'title', 'baseLevel', 'baitcoinLevel', 'weightG', 'lengthCm'],
})
