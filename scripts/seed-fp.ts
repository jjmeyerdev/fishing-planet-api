import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/db.js'

// Enriches Fish + Location from the structured FP-Collective JSON in data/fp/,
// rebuilds FishLocation presence (young/common/trophy/unique + monster classes),
// and populates the fish<->bait and fish<->lure-type join tables.
//
//   pnpm seed:fp
//
// Idempotent. Additive for curated Fish columns: fpId/slug/imageUrl are always
// set, scientificName/description are filled only when currently empty, and
// isMonster is only ever set true (never cleared). Run `pnpm seed:gear` first so
// the bait/lure-type rows exist for the links to resolve.

interface FishRaw {
  id: number
  slug: string
  title: string
  content?: string
  image?: string
  latinName?: string
  baitIds?: number[]
  lureIds?: number[]
}
interface PlaceRaw {
  id: number
  slug: string
  title: string
  image?: string
  fishDetails?: string
  monsterFishIds?: number[]
}
interface Detail {
  id: number
  types?: string[]
}

const read = <T>(f: string): T[] => JSON.parse(readFileSync(`data/fp/${f}`, 'utf8'))

const CLASS_MAP: Record<string, string> = { young: 'Young', common: 'Common', trophy: 'Trophy', unique: 'Unique' }
const SPOT = 'General' // place pages list fish lake-wide; matches scripts/seed.ts

// The FP-Collective prose is HTML with numeric/named entities; flatten to text.
function stripHtml(html: string | undefined): string | null {
  if (!html) return null
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}

async function main() {
  const fishJson = read<FishRaw>('fish.json')
  const places = read<PlaceRaw>('places.json')

  const monsterFpIds = new Set<number>()
  for (const p of places) for (const id of p.monsterFishIds ?? []) monsterFpIds.add(id)

  // --- 1. Enrich / insert Fish, keyed by commonName == fish.json title ---
  const existing = new Map(
    (await prisma.fish.findMany({ select: { id: true, commonName: true, scientificName: true, description: true } }))
      .map((f) => [f.commonName, f]),
  )
  const fishIdByFp = new Map<number, number>()
  let created = 0
  let enriched = 0
  for (const f of fishJson) {
    const sci = f.latinName?.trim() || null
    const desc = stripHtml(f.content)
    const isMonster = monsterFpIds.has(f.id)
    const cur = existing.get(f.title)
    if (cur) {
      const data: Record<string, unknown> = { fpId: f.id, slug: f.slug, imageUrl: f.image ?? null }
      if (!cur.scientificName && sci) data.scientificName = sci
      if (!cur.description && desc) data.description = desc
      if (isMonster) data.isMonster = true
      await prisma.fish.update({ where: { id: cur.id }, data })
      fishIdByFp.set(f.id, cur.id)
      enriched++
    } else {
      const row = await prisma.fish.create({
        data: { commonName: f.title, fpId: f.id, slug: f.slug, imageUrl: f.image ?? null, scientificName: sci, description: desc, isMonster },
      })
      fishIdByFp.set(f.id, row.id)
      created++
    }
  }
  console.log(`✓ fish: ${enriched} enriched, ${created} created`)

  // --- 2. Enrich Location, matching by name (normalizing a "(reworked)" suffix) ---
  const norm = (n: string) => n.replace(/\s*\(reworked\)\s*$/i, '').trim()
  const locByName = new Map(
    (await prisma.location.findMany({ select: { id: true, name: true } })).map((l) => [norm(l.name), l]),
  )
  const locIdByFp = new Map<number, number>()
  for (const p of places) {
    const loc = locByName.get(p.title)
    if (!loc) {
      console.warn(`⚠ no DB location for place "${p.title}", skipping`)
      continue
    }
    await prisma.location.update({ where: { id: loc.id }, data: { fpId: p.id, slug: p.slug, imageUrl: p.image ?? null } })
    locIdByFp.set(p.id, loc.id)
  }
  console.log(`✓ locations: ${locIdByFp.size} enriched`)

  // --- 3. Rebuild lake-wide FishLocation presence for these places (atomic) ---
  const flRows: Array<{ fishId: number; locationId: number; specificSpot: string; classesPresent: string[] }> = []
  const locIds: number[] = []
  let missingFish = 0
  for (const p of places) {
    const locationId = locIdByFp.get(p.id)
    if (locationId == null) continue
    locIds.push(locationId)
    const details: Detail[] = JSON.parse(p.fishDetails || '[]')
    for (const d of details) {
      const fishId = fishIdByFp.get(d.id)
      if (fishId == null) { missingFish++; continue }
      flRows.push({ fishId, locationId, specificSpot: SPOT, classesPresent: (d.types ?? []).map((t) => CLASS_MAP[t] ?? t) })
    }
    for (const mfp of p.monsterFishIds ?? []) {
      const fishId = fishIdByFp.get(mfp)
      if (fishId == null) { missingFish++; continue }
      flRows.push({ fishId, locationId, specificSpot: SPOT, classesPresent: ['Monster'] })
    }
  }
  await prisma.$transaction([
    prisma.fishLocation.deleteMany({ where: { locationId: { in: locIds }, specificSpot: SPOT } }),
    prisma.fishLocation.createMany({ data: flRows, skipDuplicates: true }),
  ])
  console.log(`✓ fish_locations: ${flRows.length} rows across ${locIds.length} locations${missingFish ? ` (${missingFish} skipped: no fish row)` : ''}`)

  // --- 4. Populate fish<->bait and fish<->lure-type links (full rebuild) ---
  const baitIdByFp = new Map((await prisma.bait.findMany({ select: { id: true, fpId: true } })).map((b) => [b.fpId, b.id]))
  const lureTypeIdByFp = new Map((await prisma.lureType.findMany({ select: { id: true, fpId: true } })).map((t) => [t.fpId, t.id]))
  if (baitIdByFp.size === 0 || lureTypeIdByFp.size === 0) {
    console.warn('⚠ no baits/lure-types found — run `pnpm seed:gear` first, or the links will be empty')
  }
  const baitLinks: Array<{ fishId: number; baitId: number }> = []
  const lureLinks: Array<{ fishId: number; lureTypeId: number }> = []
  let danglingBait = 0
  let danglingLure = 0
  for (const f of fishJson) {
    const fishId = fishIdByFp.get(f.id)
    if (fishId == null) continue
    for (const bfp of f.baitIds ?? []) {
      const baitId = baitIdByFp.get(bfp)
      if (baitId == null) { danglingBait++; continue }
      baitLinks.push({ fishId, baitId })
    }
    for (const lfp of f.lureIds ?? []) {
      const lureTypeId = lureTypeIdByFp.get(lfp)
      if (lureTypeId == null) { danglingLure++; continue }
      lureLinks.push({ fishId, lureTypeId })
    }
  }
  await prisma.$transaction([
    prisma.fishBait.deleteMany({}),
    prisma.fishBait.createMany({ data: baitLinks, skipDuplicates: true }),
  ])
  await prisma.$transaction([
    prisma.fishLureType.deleteMany({}),
    prisma.fishLureType.createMany({ data: lureLinks, skipDuplicates: true }),
  ])
  console.log(`✓ fish_baits: ${baitLinks.length} links${danglingBait ? ` (${danglingBait} baitIds unresolved)` : ''}`)
  console.log(`✓ fish_lure_types: ${lureLinks.length} links${danglingLure ? ` (${danglingLure} lureIds unresolved)` : ''}`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
