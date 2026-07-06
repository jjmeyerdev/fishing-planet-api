import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'title', kind: 'search' },
  { param: 'color', field: 'color', kind: 'string' },
  { param: 'baseLevel', field: 'baseLevel', kind: 'int' },
]

export const addons = crudResource({
  model: prisma.addon,
  fields: ['fpId', 'title', 'slug', 'imageUrl', 'baseLevel', 'baitcoinLevel', 'color', 'lengthCm', 'tags'],
  filters: FILTERS,
  sortable: ['id', 'title', 'baseLevel', 'baitcoinLevel'],
})
