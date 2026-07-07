import { Hono } from 'hono'
import { prisma } from '../../db.js'
import { readResource } from './read.js'
import type { FilterSpec } from '../helpers.js'

// Read-only API over the standalone wiki_* dataset, mounted under /api/wiki so it
// doesn't collide with the FP-Collective resources (e.g. /api/baits). This slice
// covers species + the headline gear categories; the consumables + brand/tech
// tables follow in a later slice.

const byName: FilterSpec = { param: 'q', field: 'name', kind: 'search' }
const bySubtype: FilterSpec = { param: 'subtype', field: 'subtype', kind: 'string' }
const byKind: FilterSpec = { param: 'kind', field: 'kind', kind: 'string' }
const gearSort = ['id', 'name', 'subtype']
const gearTech = { brand: true, variants: true, technologies: { include: { technology: true } } }
const gearBrand = { brand: true, variants: true }

export const wiki = new Hono()

wiki.route(
  '/species',
  readResource({
    model: prisma.wikiSpecies,
    filters: [byName, { param: 'family', field: 'family', kind: 'string' }],
    sortable: ['id', 'name', 'family'],
    include: { baits: { include: { bait: true } }, lures: { include: { lure: true } }, locations: true },
  }),
)
wiki.route('/reels', readResource({ model: prisma.wikiReel, filters: [byName, bySubtype], sortable: gearSort, include: gearTech }))
wiki.route('/rods', readResource({ model: prisma.wikiRod, filters: [byName, bySubtype], sortable: gearSort, include: gearTech }))
wiki.route('/lines', readResource({ model: prisma.wikiLine, filters: [byName, bySubtype, byKind], sortable: gearSort, include: gearBrand }))
wiki.route('/hooks', readResource({ model: prisma.wikiHook, filters: [byName, bySubtype, byKind], sortable: gearSort, include: gearBrand }))
wiki.route('/sinkers', readResource({ model: prisma.wikiSinker, filters: [byName, bySubtype, byKind], sortable: gearSort, include: gearBrand }))
wiki.route('/bobbers', readResource({ model: prisma.wikiBobber, filters: [byName, bySubtype], sortable: gearSort }))
wiki.route('/lures', readResource({ model: prisma.wikiLure, filters: [byName, bySubtype], sortable: gearSort, include: { variants: true } }))
