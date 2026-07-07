import 'dotenv/config'
import Firecrawl from '@mendable/firecrawl-js'
import pLimit from 'p-limit'
import { readCache, writeCache, type CacheEntry } from './lib/cache.js'
import { readable, slugify, targetLinks } from './lib/markdown.js'

// Stage 1: scrape the wiki into the disk cache (.cache/wiki/pages). Throttled,
// retried, and resumable — a cached URL is never re-fetched, so a crash/​stop
// picks up where it left off. Uses the Firecrawl SDK directly (needs a key).
//
//   pnpm wiki:crawl
//
// Slice targets: the reel + gear sub-type pages (rods/lines/hooks/sinkers/bobbers/
// lures), and species discovered by walking /MediaWiki:Species → family pages →
// species links.

const WIKI = 'https://wiki.fishingplanet.com'
const REEL_PAGES: Array<{ url: string; subtype: string }> = [
  { url: `${WIKI}/Spinning_reels`, subtype: 'spinning' },
  { url: `${WIKI}/Casting_reels`, subtype: 'casting' },
  { url: `${WIKI}/Saltwater_reels`, subtype: 'saltwater' },
]
// The remaining tackle categories, each a set of sub-type pages under a parent
// (e.g. /Rods → /Spinning_rods …). The sub-type slug is stable, so — like the
// reel pages — we seed the list directly rather than re-discover it each run.
// subtype = slugify(readable(slug)), e.g. "Spinning_rods" → "spinning-rods".
const GEAR_CATEGORIES: Array<{ category: CacheEntry['category']; slugs: string[] }> = [
  {
    category: 'rods',
    slugs: ['Bottom_rods', 'Carp_rods', 'Casting_rods', 'Feeder_rods', 'Match_rods', 'Saltwater_rods', 'Spinning_rods', 'Spod_rods', 'Telescopic_rods'],
  },
  {
    category: 'lines',
    slugs: ['Monofilament_fishing_lines', 'Fluorocarbon_fishing_lines', 'Braided_fishing_lines', 'Saltwater_lines'],
  },
  {
    category: 'hooks',
    slugs: ['Carp_Hooks', 'Common_Jig_Heads', 'Offset_Hooks', 'Saltwater_Hooks', 'Common_Saltwater_Jig_Heads', 'Simple_Hooks'],
  },
  {
    category: 'sinkers',
    slugs: ['Cage_Feeders', 'Catapults', 'Flat_Feeders', 'PVA_Feeders', 'Saltwater_Sinkers', 'Sinkers', 'Spod_Feeders'],
  },
  {
    category: 'bobbers',
    slugs: ['Buoys', 'Classic_Bobbers', 'Fishing_Alarm', 'Sliders', 'Wagglers'],
  },
  {
    category: 'lures',
    slugs: ['Bass_Jigs', 'Soft_plastic_baits', 'Spoons', 'Spinners', 'Plugs', 'Saltwater_lures'],
  },
  {
    // Consumable baits. Common/Worms/Fresh/Saltwater/Event are flat one-row tables;
    // Boilies_&_Pellets (and the boilie sub-section of Event) is block-per-model.
    // Literal `&` slugs → clean subtypes (worms-insects-baits); encoded at fetch.
    category: 'baits',
    slugs: ['Common_Baits', 'Worms_&_Insects_Baits', 'Fresh_Baits', 'Saltwater_Baits', 'Boilies_&_Pellets_Baits', 'Event_Baits'],
  },
  {
    // Groundbaits — feed/attractant consumables (mostly flat catalogs).
    category: 'groundbaits',
    slugs: ['Aromas', 'Carp_Groundbaits', 'Groundbait-base', 'Method_Mix_Groundbaits', 'Particles'],
  },
]
const GEAR_PAGES: Array<{ url: string; category: CacheEntry['category']; subtype: string }> = GEAR_CATEGORIES.flatMap((g) =>
  g.slugs.map((slug) => ({ url: `${WIKI}/${encodeURIComponent(slug)}`, category: g.category, subtype: slugify(readable(slug)) })),
)
// The FP species taxonomy (the wiki's Species sidebar). Each family page lists
// its resident species as image links in its main content — a small, stable set,
// so we seed from it directly (the /MediaWiki:Species index hides these in nav).
const FAMILIES = [
  'Bass_family', 'Bream_and_Roach_family', 'Carp_family', 'Catfish_family',
  'Crappie_family', 'Drum_family', 'Gar_family', 'Goby_family', 'Marlin_family',
  'Marlin_and_Mackerel_family', 'Panfish_family', 'Perch_family', 'Pike_family',
  'Piranhas_family', 'Salmon_family', 'Shinners_and_Minnows_family',
  'Sturgeon_family', 'Trout_and_Char_family', 'Tuna_family',
]

const apiKey = process.env.FIRECRAWL_API_KEY
if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set (add it to .env)')
const fc = new Firecrawl({ apiKey })
const limit = pLimit(2) // gentle concurrency toward the wiki

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (i < tries - 1) await sleep(1500 * 2 ** i) // backoff on 429/5xx/network
    }
  }
  throw new Error(`${label}: ${(last as Error)?.message ?? String(last)}`)
}

// Scrape to cache, skipping any URL already cached (the resume checkpoint).
async function scrape(url: string, category: CacheEntry['category'], subtype?: string): Promise<CacheEntry> {
  const cached = readCache(url)
  if (cached) return cached
  const doc = await withRetry(url, () => fc.scrape(url, { formats: ['markdown'], onlyMainContent: true }))
  await sleep(300) // spacing between real fetches
  const entry: CacheEntry = {
    url,
    category,
    subtype,
    fetchedAt: new Date().toISOString(),
    status: doc.metadata?.statusCode ?? 200,
    markdown: doc.markdown ?? '',
  }
  writeCache(entry)
  return entry
}

const isSpecies = (slug: string): boolean =>
  !/family/i.test(slug) &&
  !/_-_/.test(slug) && // location pages: "Lake_-_State"
  !/[:/]/.test(slug) &&
  !/^(Fish_Monsters|Main_page|Collecting|Species)$/i.test(slug)

async function speciesUrls(): Promise<string[]> {
  const out = new Set<string>()
  await Promise.all(
    FAMILIES.map((slug) =>
      limit(async () => {
        try {
          const fam = await scrape(`${WIKI}/${slug}`, 'index')
          // resident species are image links → take link targets, then filter
          for (const l of targetLinks(fam.markdown)) if (isSpecies(l.slug)) out.add(`${WIKI}/${l.slug}/en`)
        } catch (e) {
          console.warn(`✗ family ${slug}: ${(e as Error).message}`)
        }
      }),
    ),
  )
  return [...out]
}

async function main() {
  console.log('discovering species from family pages…')
  const species = await speciesUrls()
  const targets: Array<{ url: string; category: CacheEntry['category']; subtype?: string }> = [
    ...REEL_PAGES.map((r) => ({ url: r.url, category: 'reels' as const, subtype: r.subtype })),
    ...GEAR_PAGES,
    ...species.map((u) => ({ url: u, category: 'species' as const })),
  ]
  console.log(`targets: ${species.length} species + ${REEL_PAGES.length} reel pages + ${GEAR_PAGES.length} gear pages`)

  let fetched = 0
  let cached = 0
  let failed = 0
  await Promise.all(
    targets.map((t) =>
      limit(async () => {
        if (readCache(t.url)) {
          cached++
          return
        }
        try {
          await scrape(t.url, t.category, t.subtype)
          fetched++
          if (fetched % 20 === 0) console.log(`  …${fetched} fetched`)
        } catch (e) {
          failed++
          console.warn(`✗ ${t.url}: ${(e as Error).message}`)
        }
      }),
    ),
  )
  console.log(`✓ crawl: ${fetched} fetched, ${cached} cached, ${failed} failed`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
