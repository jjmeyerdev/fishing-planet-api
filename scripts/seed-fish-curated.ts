import 'dotenv/config'
import { prisma } from '../src/db.js'

// Backfills curated Fish columns from the standalone wiki_species dataset (already
// loaded in the DB), matched by name (Fish.commonName == WikiSpecies.name). This is
// the only in-repo source for these values — the FP-Collective JSON never carried
// them, so the columns were all null.
//
//   pnpm seed:fish-curated          # apply
//   pnpm seed:fish-curated --dry    # preview counts, write nothing
//
// Idempotent + additive: each field is filled only when the Fish row is currently
// empty, so any hand-curated value is preserved and a re-run is a no-op. Fields
// wiki_species can't source are left untouched: weight mins, young/monster weights,
// trophy *max* (Fish has no such column), and the farming/xp meta. Only ~half of
// the fish (those whose name matches a wiki species) are reachable; the rest stay
// null.

const DRY = process.argv.includes('--dry')
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
const empty = (v: unknown) => v === null || v === undefined || v === ''
// wiki family reads like "Panfish family"/"Catfish" — drop the trailing " family".
const stripFamily = (f: string | null) => (f ?? '').replace(/\s+family$/i, '').trim() || null

async function main() {
  const species = await prisma.wikiSpecies.findMany({
    select: {
      name: true,
      family: true,
      commonCreditsPerKg: true,
      trophyCreditsPerKg: true,
      uniqueCreditsPerKg: true,
      commonWeightMaxKg: true,
      uniqueWeightMaxKg: true,
    },
  })
  const wiki = new Map(species.map((s) => [norm(s.name), s]))

  const fish = await prisma.fish.findMany({
    select: {
      id: true,
      commonName: true,
      family: true,
      creditsPerKgCommon: true,
      creditsPerKgTrophy: true,
      creditsPerKgUnique: true,
      weightCommonMax: true,
      weightUniqueMax: true,
    },
  })

  let matched = 0
  let updated = 0
  const filled: Record<string, number> = {}
  const bump = (k: string) => (filled[k] = (filled[k] ?? 0) + 1)

  for (const f of fish) {
    const w = wiki.get(norm(f.commonName))
    if (!w) continue
    matched++

    const data: Record<string, unknown> = {}
    const fam = stripFamily(w.family)
    if (empty(f.family) && fam) {
      if (fam.length <= 50) {
        data.family = fam
        bump('family')
      } else {
        console.warn(`⚠ family too long (${fam.length} chars) for ${f.commonName}, skipped`)
      }
    }
    if (empty(f.creditsPerKgCommon) && w.commonCreditsPerKg != null) {
      data.creditsPerKgCommon = w.commonCreditsPerKg
      bump('creditsPerKgCommon')
    }
    if (empty(f.creditsPerKgTrophy) && w.trophyCreditsPerKg != null) {
      data.creditsPerKgTrophy = w.trophyCreditsPerKg
      bump('creditsPerKgTrophy')
    }
    if (empty(f.creditsPerKgUnique) && w.uniqueCreditsPerKg != null) {
      data.creditsPerKgUnique = w.uniqueCreditsPerKg
      bump('creditsPerKgUnique')
    }
    if (empty(f.weightCommonMax) && w.commonWeightMaxKg != null) {
      data.weightCommonMax = w.commonWeightMaxKg
      bump('weightCommonMax')
    }
    if (empty(f.weightUniqueMax) && w.uniqueWeightMaxKg != null) {
      data.weightUniqueMax = w.uniqueWeightMaxKg
      bump('weightUniqueMax')
    }

    if (Object.keys(data).length === 0) continue
    updated++
    if (!DRY) await prisma.fish.update({ where: { id: f.id }, data })
  }

  const verb = DRY ? 'would update' : 'updated'
  console.log(`${DRY ? '[dry] ' : ''}matched ${matched} fish to a wiki species; ${verb} ${updated} of them`)
  for (const k of Object.keys(filled).sort()) console.log(`  ${k.padEnd(20)} ${filled[k]}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
