import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'title', kind: 'search' },
  { param: 'locationId', field: 'locationId', kind: 'int' },
  { param: 'type', field: 'type', kind: 'string' },
  { param: 'legacyValue', field: 'legacyValue', kind: 'string' },
]

export const weathers = crudResource({
  model: prisma.weather,
  fields: ['fpId', 'name', 'slug', 'title', 'value', 'legacyValue', 'type', 'iconUrl', 'chartUrl', 'locationId'],
  filters: FILTERS,
  sortable: ['id', 'name', 'title', 'type', 'locationId'],
})
