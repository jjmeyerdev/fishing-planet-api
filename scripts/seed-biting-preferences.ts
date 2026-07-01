import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/db.js'

// Seeds biting_preferences from FP-Collective per-fish markdown in data/fish/.
//
//   pnpm seed:biting                     # every data/fish/*.md
//   pnpm seed:biting data/fish/x.md      # a single fish file
//
// Idempotent: re-running upserts the same row. Scope note below.
//
// Only three fields are sourced from the "How to catch" prose: the single best
// bait, the single best lure, and the bait hook size. The page has no per-fish
// depth or weather peak-time data, so depth_zone / *_peak_times stay null, and
// preferred_lure_colors is intentionally left empty (flagged disputed in schema).

const FISH_DIR = 'data/fish'

interface ParsedPref {
  commonName: string
  bestBait: string | null
  bestLure: string | null
  hookSize: string | null
}

// "...the best way to catch <Name> would be to use **Shiners** on a size #4/0 hook."
const BAIT = /best way to catch .*? would be to use \*\*(.+?)\*\* on a size (\S+) hook/i
// "...you should go for some **Bass Jigs**."
const LURE = /you should go for some \*\*(.+?)\*\*/i

function parsePref(md: string, file: string): ParsedPref | null {
  const commonName = md.match(/^#\s+(.+)$/m)?.[1].trim()
  if (!commonName) {
    console.warn(`⚠ skipping ${file}: no "# Name" heading`)
    return null
  }

  const section = /##\s+How to catch\s*\n([\s\S]*?)(?:\n##\s|$)/.exec(md)?.[1] ?? ''
  const bait = BAIT.exec(section)
  const lure = LURE.exec(section)

  return {
    commonName,
    bestBait: bait?.[1].trim() ?? null,
    hookSize: bait?.[2].trim() ?? null,
    bestLure: lure?.[1].trim() ?? null,
  }
}

async function seedPref(p: ParsedPref) {
  if (!p.bestBait && !p.bestLure) {
    console.warn(`⚠ ${p.commonName}: no bait or lure found in prose, skipping`)
    return
  }

  const fish = await prisma.fish.findUnique({ where: { commonName: p.commonName }, select: { id: true } })
  if (!fish) {
    console.warn(`⚠ ${p.commonName}: no matching fish row, skipping`)
    return
  }

  const data = {
    preferredBaits: p.bestBait ? [p.bestBait] : [],
    preferredLures: p.bestLure ? [p.bestLure] : [],
    hookSizeMin: p.hookSize,
    hookSizeMax: p.hookSize,
  }

  await prisma.bitingPreference.upsert({
    where: { fishId: fish.id },
    create: { fishId: fish.id, ...data },
    update: data,
  })

  console.log(`✓ ${p.commonName} — bait: ${p.bestBait ?? '—'}, lure: ${p.bestLure ?? '—'}, hook: ${p.hookSize ?? '—'}`)
}

async function main() {
  const arg = process.argv[2]
  const files = arg
    ? [arg]
    : readdirSync(FISH_DIR)
        .filter((f) => f.endsWith('.md'))
        .map((f) => join(FISH_DIR, f))

  if (files.length === 0) {
    console.log('No .md files found to seed.')
    return
  }

  for (const file of files) {
    const pref = parsePref(readFileSync(file, 'utf8'), file)
    if (pref) await seedPref(pref)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
