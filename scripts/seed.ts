import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/db.js'

// Seeds locations + fish + fish_locations from FP-Collective place markdown.
//
//   pnpm seed                       # every data/*.md
//   pnpm seed data/lone-star.md     # a single file
//
// Idempotent: re-running upserts the same rows. Two data-model notes below.

const DATA_DIR = 'data'

// The place page lists which fish are present lake-wide, not per-spot. The
// specific spot (part of the fish_locations PK) comes from the bite map, which
// isn't in these files — so lake-wide presence is stored under this sentinel.
const LAKE_WIDE_SPOT = 'General'

const CLASS_MAP: Record<string, string> = {
  young: 'Young',
  common: 'Common',
  trophy: 'Trophy',
  unique: 'Unique',
}

interface ParsedFish {
  name: string
  classes: string[]
  isMonster: boolean
}

interface ParsedLocation {
  name: string
  region: string
  waterwayType: string
  unlockLevel: number
  fish: ParsedFish[]
}

// waterway_type isn't on the place page. For locations whose name has no
// water-body keyword, these values are sourced from the official Fishing Planet
// wiki (wiki.fishingplanet.com) descriptions. Everything else falls back to the
// keyword inference below.
const WATERWAY_OVERRIDES: Record<string, string> = {
  'Amazonian Maze': 'River',
  'Blue Crab Island': 'Ocean',
  'Everglades': 'Swamp',
  'Ghent-Terneuzen Canal (reworked)': 'Canal',
  'Kaiji No Ri': 'Ocean',
  'Lesni Vila Fishery (reworked)': 'Pond',
  'Noomaa Kuda Atholhu': 'Ocean',
  'San Joaquin Delta': 'Delta',
  'Skårland Fjord': 'Ocean',
  'Weeping Willow Fisheries': 'Pond',
}

function inferWaterway(name: string): string {
  if (WATERWAY_OVERRIDES[name]) return WATERWAY_OVERRIDES[name]
  const n = name.toLowerCase()
  if (n.includes('lake')) return 'Lake'
  if (n.includes('river')) return 'River'
  if (n.includes('reservoir')) return 'Reservoir'
  if (n.includes('pond')) return 'Pond'
  if (n.includes('creek')) return 'Creek'
  if (n.includes('bayou')) return 'Bayou'
  if (n.includes('bay') || n.includes('sea') || n.includes('coast')) return 'Ocean'
  return 'Unknown'
}

function parseClasses(raw: string): string[] {
  return raw
    .split(',')
    .map((c) => CLASS_MAP[c.trim().toLowerCase()])
    .filter((c): c is string => Boolean(c))
}

// Matches: [common, trophy **Bluegill**](https://...)
const FISH_ENTRY = /\[([^\]]*?)\*\*([^*]+?)\*\*\]\(([^)]+)\)/g

function parseFishSection(md: string, header: string, isMonster: boolean): ParsedFish[] {
  const section = new RegExp(`##\\s+${header}\\s*\\n([\\s\\S]*?)(?:\\n##\\s|$)`).exec(md)
  if (!section) return []
  const out: ParsedFish[] = []
  for (const m of section[1].matchAll(FISH_ENTRY)) {
    out.push({ classes: parseClasses(m[1]), name: m[2].trim(), isMonster })
  }
  return out
}

function parseLocation(md: string, file: string): ParsedLocation | null {
  const name = md.match(/^#\s+(.+)$/m)?.[1].trim()
  const region = md.match(/^Region[:\s]*(.+)$/m)?.[1].trim()
  const continent = md.match(/^Continent[:\s]*(.+)$/m)?.[1].trim()
  const level = md.match(/^Level[:\s]*(\d+)/m)?.[1]

  if (!name || !region || !continent || !level) {
    console.warn(`⚠ skipping ${file}: missing name/region/continent/level`)
    return null
  }

  return {
    name,
    region: `${region}, ${continent}`, // e.g. "Texas, North America"
    waterwayType: inferWaterway(name),
    unlockLevel: Number(level),
    fish: [
      ...parseFishSection(md, 'Fish', false),
      ...parseFishSection(md, 'Monster Fish', true),
    ],
  }
}

async function seedLocation(loc: ParsedLocation) {
  const location = await prisma.location.upsert({
    where: { name: loc.name },
    create: { name: loc.name, region: loc.region, waterwayType: loc.waterwayType, unlockLevel: loc.unlockLevel },
    update: { region: loc.region, waterwayType: loc.waterwayType, unlockLevel: loc.unlockLevel },
  })

  for (const f of loc.fish) {
    const fish = await prisma.fish.upsert({
      where: { commonName: f.name },
      create: { commonName: f.name, isMonster: f.isMonster },
      update: f.isMonster ? { isMonster: true } : {},
    })
    await prisma.fishLocation.upsert({
      where: {
        fishId_locationId_specificSpot: {
          fishId: fish.id,
          locationId: location.id,
          specificSpot: LAKE_WIDE_SPOT,
        },
      },
      create: { fishId: fish.id, locationId: location.id, specificSpot: LAKE_WIDE_SPOT, classesPresent: f.classes },
      update: { classesPresent: f.classes },
    })
  }

  console.log(`✓ ${loc.name} — ${loc.waterwayType}, "${loc.region}", level ${loc.unlockLevel}, ${loc.fish.length} fish`)
}

async function main() {
  const arg = process.argv[2]
  const files = arg
    ? [arg]
    : readdirSync(DATA_DIR)
        .filter((f) => f.endsWith('.md') && !f.endsWith('-old.md')) // skip superseded map versions
        .map((f) => join(DATA_DIR, f))

  if (files.length === 0) {
    console.log('No .md files found to seed.')
    return
  }

  for (const file of files) {
    const loc = parseLocation(readFileSync(file, 'utf8'), file)
    if (loc) await seedLocation(loc)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
