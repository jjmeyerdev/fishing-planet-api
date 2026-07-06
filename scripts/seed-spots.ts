import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/db.js'

// Seeds geo Spots and per-location Weather from the vendored FP-Collective JSON
// in data/fp/ (spots.json, weathers.json).
//
//   pnpm seed:spots            # spots then weathers
//   pnpm seed:spots spots      # a single entity (spots|weathers)
//
// Each row resolves its Location via the source placeId (a single-element array)
// matched to Location.fpId, so `pnpm seed:fp` must have run first to backfill
// those fpIds. Idempotent: upserts on the FP-Collective id (fpId). Rows whose
// placeId doesn't resolve to a seeded Location (one removed place, fpId 204) are
// skipped with a count.

interface SpotRaw {
  id: number
  name: string
  slug: string
  title: string
  image?: string
  lat: number
  lng: number
  x: number
  y: number
  placeId: number[]
}
interface WeatherRaw {
  id: number
  name: string
  slug: string
  title: string
  value: string
  legacyValue: string
  type: string
  icon?: string
  chart?: string
  placeId: number[]
}

const read = <T>(f: string): T[] => JSON.parse(readFileSync(`data/fp/${f}`, 'utf8'))

// A structural view of a Prisma delegate's upsert (keyed on the unique fpId).
interface Upsertable {
  upsert(args: {
    where: { fpId: number }
    create: Record<string, unknown>
    update: Record<string, unknown>
  }): Promise<unknown>
}

async function seed<T extends { id: number; placeId: number[] }>(
  model: Upsertable,
  rows: T[],
  locIdByFp: Map<number, number>,
  toData: (r: T, locationId: number) => Record<string, unknown>,
  label: string,
) {
  let upserted = 0
  let skipped = 0
  for (const r of rows) {
    const locationId = locIdByFp.get(r.placeId[0])
    if (locationId == null) {
      skipped++
      continue
    }
    const data = toData(r, locationId)
    await model.upsert({ where: { fpId: r.id }, create: data, update: data })
    upserted++
  }
  console.log(`✓ ${label}: ${upserted} upserted${skipped ? ` (${skipped} skipped: placeId not a seeded location)` : ''}`)
}

const ENTITIES: Record<string, (locIdByFp: Map<number, number>) => Promise<void>> = {
  spots: (locIdByFp) =>
    seed(prisma.spot as Upsertable, read<SpotRaw>('spots.json'), locIdByFp, (r, locationId) => ({
      fpId: r.id,
      name: r.name,
      slug: r.slug,
      title: r.title,
      lat: r.lat,
      lng: r.lng,
      x: r.x,
      y: r.y,
      imageUrl: r.image ?? null,
      locationId,
    }), 'spots'),
  weathers: (locIdByFp) =>
    seed(prisma.weather as Upsertable, read<WeatherRaw>('weathers.json'), locIdByFp, (r, locationId) => ({
      fpId: r.id,
      name: r.name,
      slug: r.slug,
      title: r.title,
      value: r.value,
      legacyValue: r.legacyValue,
      type: r.type,
      iconUrl: r.icon ?? null,
      chartUrl: r.chart ?? null,
      locationId,
    }), 'weathers'),
}

const ORDER = ['spots', 'weathers']

async function main() {
  const only = process.argv[2]
  const names = only ? [only] : ORDER

  const locations = await prisma.location.findMany({ where: { fpId: { not: null } }, select: { id: true, fpId: true } })
  const locIdByFp = new Map(locations.map((l) => [l.fpId as number, l.id]))
  if (locIdByFp.size === 0) {
    console.warn('⚠ no locations have an fpId — run `pnpm seed:fp` first, or every row will be skipped')
  }

  for (const name of names) {
    const run = ENTITIES[name]
    if (!run) {
      console.error(`Unknown entity "${name}". One of: ${ORDER.join(', ')}`)
      process.exitCode = 1
      break
    }
    await run(locIdByFp)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
