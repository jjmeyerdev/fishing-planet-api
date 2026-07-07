import 'dotenv/config'
import Firecrawl from '@mendable/firecrawl-js'
import { prisma } from '../../src/db.js'
import { parseSpecies } from './lib/parse-species.js'
import { readCache, writeCache } from './lib/cache.js'

// Enriches wiki_species with the fish the family-discovery crawl (crawl.ts) misses.
// Species are discovered only from a hardcoded list of 19 family pages, so fish in
// other families (Amazonian, sharks, …) were never fetched — ~half the Fish rows
// had no wiki_species match, and the curated backfill (seed:fish-curated) couldn't
// reach them. This scrapes each Fish that has no wiki_species row by its wiki URL —
// /<Name>/en, falling back to /<Name> for untranslated pages (most saltwater fish) —
// reusing parseSpecies + the same upsert shape as load.ts.
// Idempotent (cache + upsert on slug). Run after wiki:load + seed:fp, then follow
// with `pnpm seed:fish-curated`. A future full wiki:load resolves the new species'
// bait/lure link FKs (stored raw name+slug here).
//
//   pnpm wiki:enrich-species        # all unmatched fish
//   pnpm wiki:enrich-species 5      # cap the scrape count (smoke test)

const WIKI = 'https://wiki.fishingplanet.com'
const LIMIT = Number(process.argv[2]) || Infinity

const apiKey = process.env.FIRECRAWL_API_KEY
if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set (add it to .env)')
const fc = new Firecrawl({ apiKey })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// Fish whose wiki page sits under a different title than Fish.commonName (our name →
// wiki slug). The row is stored under our name below, so seed:fish-curated still matches.
const ALIASES: Record<string, string> = {
  'Black Bullhead': 'Black_Bullhead_Catfish',
  'Brown Bullhead': 'Brown_Bullhead_Catfish',
  'Flag-tailed Prochilodus': 'Flag-Tailed_Prochilodus',
  Sorubim: 'Sorubim_Catfish',
  'European Chub': 'Chub',
  Muskie: 'Muskellunge',
  'Steelhead Trout': 'Steelhead',
  'Volga Zander': 'Zander',
}
// Aliases whose wiki slug already belongs to a different, already-matched species
// (`Zander` is Fish "Zander"): store the row under our own slug so the upsert can't
// clobber it. The data is the base page's — Volga Zander has no page, so it ≈ Zander.
const OWN_SLUG = new Set(['Volga Zander'])
const wikiSlug = (name: string) => encodeURIComponent(ALIASES[name] ?? name.replace(/ /g, '_'))
// Try the translated page first, then the base URL: untranslated pages (most of the
// saltwater / Norway fish) exist only at /<Name>, not /<Name>/en.
const variantsFor = (name: string) => [`${WIKI}/${wikiSlug(name)}/en`, `${WIKI}/${wikiSlug(name)}`]
// A real fish infobox carries a weight, credit, or family; "no article" pages don't.
const hasData = (s: ReturnType<typeof parseSpecies>) =>
  s.family != null ||
  [s.commonWeightMaxKg, s.trophyWeightMaxKg, s.uniqueWeightMaxKg, s.commonCreditsPerKg, s.trophyCreditsPerKg, s.uniqueCreditsPerKg].some((v) => v != null)

// Scrape to markdown, cache-aware (a cached URL is never re-fetched), with backoff.
async function scrapeMarkdown(url: string): Promise<{ status: number; markdown: string }> {
  const cached = readCache(url)
  if (cached) return { status: cached.status, markdown: cached.markdown }
  for (let i = 0; i < 3; i++) {
    try {
      const doc = await fc.scrape(url, { formats: ['markdown'], onlyMainContent: true })
      await sleep(300)
      return { status: doc.metadata?.statusCode ?? 200, markdown: doc.markdown ?? '' }
    } catch (e) {
      if (i === 2) throw e
      await sleep(1500 * 2 ** i)
    }
  }
  return { status: 0, markdown: '' }
}

async function main() {
  const [fish, species] = await Promise.all([
    prisma.fish.findMany({ select: { commonName: true } }),
    prisma.wikiSpecies.findMany({ select: { name: true } }),
  ])
  const known = new Set(species.map((s) => s.name.trim().toLowerCase()))
  const unmatched = fish.map((f) => f.commonName).filter((n) => !known.has(n.trim().toLowerCase()))
  const targets = unmatched.slice(0, LIMIT)
  console.log(`unmatched fish: ${unmatched.length}; scraping ${targets.length}…`)

  let upserted = 0
  let noPage = 0
  let failed = 0
  for (const name of targets) {
    let found: { url: string; markdown: string; s: ReturnType<typeof parseSpecies> } | null = null
    let errored = false
    for (const url of variantsFor(name)) {
      try {
        const res = await scrapeMarkdown(url)
        if (res.status === 200 && res.markdown) {
          const s = parseSpecies(res.markdown, url)
          if (hasData(s)) {
            found = { url, markdown: res.markdown, s }
            break
          }
        }
      } catch (e) {
        errored = true
        console.warn(`✗ ${name} (${url}): ${(e as Error).message}`)
      }
    }
    if (!found) {
      if (errored) failed++
      else noPage++
      continue
    }
    const { url, markdown, s } = found
    // Cache the real page so future full pipeline runs (wiki:parse/load) include it too.
    writeCache({ url, category: 'species', fetchedAt: new Date().toISOString(), status: 200, markdown })
    const fields = {
      name: ALIASES[name] ? name : s.name,
      latinName: s.latinName,
      family: s.family,
      description: s.description,
      imageUrl: s.imageUrl,
      wikipediaUrl: s.wikipediaUrl,
      commonWeightMaxKg: s.commonWeightMaxKg,
      trophyWeightMaxKg: s.trophyWeightMaxKg,
      uniqueWeightMaxKg: s.uniqueWeightMaxKg,
      commonCreditsPerKg: s.commonCreditsPerKg,
      trophyCreditsPerKg: s.trophyCreditsPerKg,
      uniqueCreditsPerKg: s.uniqueCreditsPerKg,
      hookSizeMin: s.hookSizeMin,
      hookSizeMax: s.hookSizeMax,
      sourceUrl: s.sourceUrl,
      contentHash: s.contentHash,
      scrapedAt: new Date(),
    }
    const slug = OWN_SLUG.has(name) ? name.replace(/ /g, '_') : s.slug
    const row = await prisma.wikiSpecies.upsert({ where: { slug }, create: { slug, ...fields }, update: fields })
    await prisma.$transaction([
      prisma.wikiSpeciesBait.deleteMany({ where: { speciesId: row.id } }),
      prisma.wikiSpeciesBait.createMany({ data: s.baits.map((l) => ({ speciesId: row.id, name: l.name, slug: l.slug })), skipDuplicates: true }),
      prisma.wikiSpeciesLure.deleteMany({ where: { speciesId: row.id } }),
      prisma.wikiSpeciesLure.createMany({ data: s.lures.map((l) => ({ speciesId: row.id, name: l.name, slug: l.slug })), skipDuplicates: true }),
      prisma.wikiSpeciesLocation.deleteMany({ where: { speciesId: row.id } }),
      prisma.wikiSpeciesLocation.createMany({ data: s.locations.map((l) => ({ speciesId: row.id, name: l.name, slug: l.slug })), skipDuplicates: true }),
    ])
    upserted++
  }
  console.log(`✓ enriched wiki_species: ${upserted} upserted, ${noPage} no-page, ${failed} failed`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
