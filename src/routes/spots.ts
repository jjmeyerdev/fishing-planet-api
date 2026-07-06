import { prisma } from '../db.js'
import { crudResource } from './crud.js'
import type { FilterSpec } from './helpers.js'

const FILTERS: FilterSpec[] = [
  { param: 'q', field: 'title', kind: 'search' },
  { param: 'locationId', field: 'locationId', kind: 'int' },
]

export const spots = crudResource({
  model: prisma.spot,
  fields: ['fpId', 'name', 'slug', 'title', 'lat', 'lng', 'x', 'y', 'imageUrl', 'locationId'],
  filters: FILTERS,
  sortable: ['id', 'name', 'title', 'locationId'],
})
