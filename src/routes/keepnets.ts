import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'title', kind: 'search' },
  { param: 'type', field: 'type', kind: 'string' },
  { param: 'isFishFriendly', field: 'isFishFriendly', kind: 'boolean' },
  { param: 'baseLevel', field: 'baseLevel', kind: 'int' },
]

export const keepnets = crudResource({
  model: prisma.keepnet,
  fields: ['fpId', 'title', 'slug', 'imageUrl', 'baseLevel', 'baitcoinLevel', 'type', 'isFishFriendly'],
  filters: FILTERS,
  sortable: ['id', 'title', 'baseLevel', 'baitcoinLevel'],
})
