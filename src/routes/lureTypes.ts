import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [{ param: 'q', field: 'title', kind: 'search' }]

export const lureTypes = crudResource({
  model: prisma.lureType,
  fields: ['fpId', 'title', 'slug', 'imageUrl', 'tags'],
  filters: FILTERS,
  sortable: ['id', 'title'],
})
