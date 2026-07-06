import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'title', kind: 'search' },
  { param: 'baitType', field: 'baitType', kind: 'string' },
  { param: 'baseLevel', field: 'baseLevel', kind: 'int' },
]

export const baits = crudResource({
  model: prisma.bait,
  fields: ['fpId', 'title', 'slug', 'imageUrl', 'baseLevel', 'baitcoinLevel', 'baitType', 'tags'],
  filters: FILTERS,
  sortable: ['id', 'title', 'baseLevel', 'baitcoinLevel', 'baitType'],
})
