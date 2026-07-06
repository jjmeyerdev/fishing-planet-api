import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/db.js'

// Seeds the tackle catalog from the vendored FP-Collective JSON in data/fp/:
// baits, boilies, lures, lure-types, hooks, jigheads, sinkers, keepnets, addons.
//
//   pnpm seed:gear            # every gear entity
//   pnpm seed:gear baits      # a single entity by name (see ENTITIES below)
//
// Idempotent: upserts on the FP-Collective id (fpId). lure-types are seeded
// before lures so each lure resolves its lureType (matched by name) to an id.

const DIR = 'data/fp'

interface Raw {
  id: number
  title: string
  slug: string
  image?: string
  baseLevel?: number
  baitcoinLevel?: number
  tags?: string[]
  specs?: Record<string, { value?: unknown } | undefined>
  [k: string]: unknown
}

// A structural view of a Prisma delegate's upsert (keyed on the unique fpId).
interface Upsertable {
  upsert(args: {
    where: { fpId: number }
    create: Record<string, unknown>
    update: Record<string, unknown>
  }): Promise<unknown>
}

const read = (file: string): Raw[] => JSON.parse(readFileSync(join(DIR, file), 'utf8'))
const specVal = (r: Raw, key: string): unknown => r.specs?.[key]?.value

// Empty strings in the source (e.g. color: "") become null.
const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const int = (v: unknown): number | null => {
  const n = num(v)
  return n === null ? null : Math.trunc(n)
}

const core = (r: Raw) => ({ fpId: r.id, title: r.title, slug: r.slug, imageUrl: r.image ?? null })
const leveled = (r: Raw) => ({ ...core(r), baseLevel: r.baseLevel ?? 0, baitcoinLevel: r.baitcoinLevel ?? 0 })
const withTags = (r: Raw) => ({ tags: Array.isArray(r.tags) ? r.tags : [] })

async function upsertMany(model: Upsertable, rows: Raw[], toData: (r: Raw) => Record<string, unknown>, label: string) {
  for (const r of rows) {
    const data = toData(r)
    await model.upsert({ where: { fpId: r.id }, create: data, update: data })
  }
  console.log(`✓ ${label}: ${rows.length} upserted`)
}

// lure-types must be seeded before lures resolve their type, so it runs first.
async function seedLures() {
  const types = await prisma.lureType.findMany({ select: { id: true, title: true } })
  const idByTitle = new Map(types.map((t) => [t.title, t.id]))
  const missing = new Set<string>()
  await upsertMany(prisma.lure as Upsertable, read('lures.json'), (r) => {
    const typeName = String(r.lureType ?? '')
    const lureTypeId = idByTitle.get(typeName) ?? null
    if (typeName && lureTypeId === null) missing.add(typeName)
    return {
      ...leveled(r),
      ...withTags(r),
      color: str(r.color),
      weightG: num(specVal(r, 'weight')),
      lengthCm: num(specVal(r, 'length')),
      lureTypeId,
    }
  }, 'lures')
  if (missing.size) console.warn(`⚠ lures referenced ${missing.size} unmatched lure-type name(s): ${[...missing].join(', ')}`)
}

const ENTITIES: Record<string, () => Promise<void>> = {
  baits: () => upsertMany(prisma.bait as Upsertable, read('baits.json'), (r) => ({ ...leveled(r), ...withTags(r), baitType: r.baitType }), 'baits'),
  boilies: () => upsertMany(prisma.boilie as Upsertable, read('boilies-pellets.json'), (r) => ({ ...leveled(r), ...withTags(r), baitType: r.baitType, diameterMm: int(specVal(r, 'diameter')) }), 'boilies'),
  'lure-types': () => upsertMany(prisma.lureType as Upsertable, read('lure-types.json'), (r) => ({ ...core(r), ...withTags(r) }), 'lure-types'),
  lures: seedLures,
  hooks: () => upsertMany(prisma.hook as Upsertable, read('hooks.json'), (r) => ({ ...leveled(r), ...withTags(r), size: r.size, type: r.type }), 'hooks'),
  jigheads: () => upsertMany(prisma.jighead as Upsertable, read('jigheads.json'), (r) => ({ ...leveled(r), ...withTags(r), size: r.size, weightG: num(specVal(r, 'weight') ?? r.weight), color: str(r.color) }), 'jigheads'),
  sinkers: () => upsertMany(prisma.sinker as Upsertable, read('sinkers.json'), (r) => ({ ...leveled(r), ...withTags(r), form: r.form, weightG: num(specVal(r, 'weight') ?? r.weight), color: str(r.color) }), 'sinkers'),
  keepnets: () => upsertMany(prisma.keepnet as Upsertable, read('keepnets-stringers.json'), (r) => ({ ...leveled(r), type: r.type, isFishFriendly: r.isFishFriendly }), 'keepnets'),
  addons: () => upsertMany(prisma.addon as Upsertable, read('addons.json'), (r) => ({ ...leveled(r), ...withTags(r), color: str(r.color), lengthCm: num(specVal(r, 'length')) }), 'addons'),
}

// Order matters: lure-types before lures (the FK resolves by name).
const ORDER = ['baits', 'boilies', 'lure-types', 'lures', 'hooks', 'jigheads', 'sinkers', 'keepnets', 'addons']

async function main() {
  const only = process.argv[2]
  const names = only ? [only] : ORDER
  for (const name of names) {
    const run = ENTITIES[name]
    if (!run) {
      console.error(`Unknown gear entity "${name}". One of: ${ORDER.join(', ')}`)
      process.exitCode = 1
      break
    }
    await run()
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
