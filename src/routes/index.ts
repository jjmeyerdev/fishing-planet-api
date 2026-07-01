import { Hono } from 'hono'
import { fish } from './fish.js'
import { locations } from './locations.js'
import { fishLocations } from './fishLocations.js'
import { bitingPreferences } from './bitingPreferences.js'

export const routes = new Hono()

routes.get('/', (c) => c.json({ message: 'fishing-planet-api v1' }))

routes.route('/fish', fish)
routes.route('/locations', locations)
routes.route('/fish-locations', fishLocations)
routes.route('/biting-preferences', bitingPreferences)
