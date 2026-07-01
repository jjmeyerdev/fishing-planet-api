import 'dotenv/config'
import { prisma } from '../src/db.js'

const [locations, fish, monsters, fishLocations, byWaterway] = await Promise.all([
  prisma.location.count(),
  prisma.fish.count(),
  prisma.fish.count({ where: { isMonster: true } }),
  prisma.fishLocation.count(),
  prisma.location.groupBy({ by: ['waterwayType'], _count: true, orderBy: { waterwayType: 'asc' } }),
])

console.log(`locations:       ${locations}`)
console.log(`fish (distinct): ${fish}  (monsters: ${monsters})`)
console.log(`fish_locations:  ${fishLocations}`)
console.log(`waterway types:  ${byWaterway.map((w) => `${w.waterwayType} ${w._count}`).join(', ')}`)

await prisma.$disconnect()
