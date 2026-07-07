import { Hono } from 'hono'
import { fish } from './fish.js'
import { locations } from './locations.js'
import { fishLocations } from './fishLocations.js'
import { bitingPreferences } from './bitingPreferences.js'
import { baits } from './baits.js'
import { boilies } from './boilies.js'
import { lureTypes } from './lureTypes.js'
import { lures } from './lures.js'
import { hooks } from './hooks.js'
import { jigheads } from './jigheads.js'
import { sinkers } from './sinkers.js'
import { keepnets } from './keepnets.js'
import { addons } from './addons.js'
import { spots } from './spots.js'
import { weathers } from './weathers.js'
import { wiki } from './wiki/index.js'

export const routes = new Hono()

routes.get('/', (c) => c.json({ message: 'fishing-planet-api v1' }))

routes.route('/fish', fish)
routes.route('/locations', locations)
routes.route('/fish-locations', fishLocations)
routes.route('/biting-preferences', bitingPreferences)

// Tackle catalog (uniform id-in-path CRUD via crudResource)
routes.route('/baits', baits)
routes.route('/boilies', boilies)
routes.route('/lure-types', lureTypes)
routes.route('/lures', lures)
routes.route('/hooks', hooks)
routes.route('/jigheads', jigheads)
routes.route('/sinkers', sinkers)
routes.route('/keepnets', keepnets)
routes.route('/addons', addons)

// Geo spots + per-location weather (uniform id-in-path CRUD via crudResource)
routes.route('/spots', spots)
routes.route('/weathers', weathers)

// Read-only API over the standalone wiki_* dataset (species + headline gear)
routes.route('/wiki', wiki)
