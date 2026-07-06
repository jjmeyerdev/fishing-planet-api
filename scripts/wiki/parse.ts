import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allPages, CACHE_DIR } from './lib/cache.js'
import { parseReels } from './lib/parse-reels.js'
import { parseSpecies } from './lib/parse-species.js'
import type { ParsedBrand, ParsedDataset, ParsedReel, ParsedSpecies, ParsedTechnology, ReelSubtype } from './lib/types.js'

// Stage 2: read the raw disk cache, parse each page into normalized records, and
// write .cache/wiki/parsed.json. Pure (no network / no DB) — safe to re-run.
//
//   pnpm wiki:parse
//
// Brands and technologies are derived from the reels (their dedicated /Brands and
// /Reels_technologies pages enrich these rows in a later phase).

function main() {
  const species: ParsedSpecies[] = []
  const reels: ParsedReel[] = []

  for (const p of allPages()) {
    if (p.status !== 200) continue
    if (p.category === 'species') species.push(parseSpecies(p.markdown, p.url))
    else if (p.category === 'reels') reels.push(...parseReels(p.markdown, p.url, (p.subtype ?? 'spinning') as ReelSubtype))
  }

  const brands = new Map<string, ParsedBrand>()
  const technologies = new Map<string, ParsedTechnology>()
  for (const r of reels) {
    if (r.brand && !brands.has(r.brand.slug)) {
      brands.set(r.brand.slug, { slug: r.brand.slug, name: r.brand.name, description: null, imageUrl: null, sourceUrl: null, contentHash: null })
    }
    for (const t of r.technologies) {
      if (!technologies.has(t.slug)) technologies.set(t.slug, { slug: t.slug, name: t.name, description: null, category: 'reel' })
    }
  }

  const dataset: ParsedDataset = { species, reels, brands: [...brands.values()], technologies: [...technologies.values()] }
  mkdirSync(CACHE_DIR, { recursive: true })
  const out = join(CACHE_DIR, 'parsed.json')
  writeFileSync(out, JSON.stringify(dataset, null, 2))
  console.log(`✓ parsed: ${species.length} species, ${reels.length} reels, ${dataset.brands.length} brands, ${dataset.technologies.length} technologies → ${out}`)
}

main()
