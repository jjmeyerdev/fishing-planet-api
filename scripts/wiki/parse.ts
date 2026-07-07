import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allPages, CACHE_DIR } from './lib/cache.js'
import { parseReels } from './lib/parse-reels.js'
import { parseRods } from './lib/parse-rods.js'
import { parseLines } from './lib/parse-lines.js'
import { parseHooks } from './lib/parse-hooks.js'
import { parseSinkers } from './lib/parse-sinkers.js'
import { parseBobbers } from './lib/parse-bobbers.js'
import { parseLures } from './lib/parse-lures.js'
import { parseBaits } from './lib/parse-baits.js'
import { parseBoilies } from './lib/parse-boilies.js'
import { parseGroundbaits, parseGroundbaitMixes } from './lib/parse-groundbaits.js'
import { parseEquipment, parseStringersKeepnets } from './lib/parse-equipment.js'
import { parseTransport } from './lib/parse-transport.js'
import { parseOther } from './lib/parse-other.js'
import { parseBrands } from './lib/parse-brands.js'
import { parseTechnologies } from './lib/parse-technologies.js'
import { parseSpecies } from './lib/parse-species.js'
import type {
  ParsedBait,
  ParsedBobber,
  ParsedBoilie,
  ParsedBrand,
  ParsedDataset,
  ParsedEquipment,
  ParsedGroundbait,
  ParsedHook,
  ParsedLine,
  ParsedLure,
  ParsedOther,
  ParsedReel,
  ParsedRod,
  ParsedSinker,
  ParsedSpecies,
  ParsedTechnology,
  ParsedTransport,
  ReelSubtype,
  WikiLink,
} from './lib/types.js'

// Stage 2: read the raw disk cache, parse each page into normalized records, and
// write .cache/wiki/parsed.json. Pure (no network / no DB) — safe to re-run.
//
//   pnpm wiki:parse
//
// Brands and technologies are derived from the reels + rods (their dedicated
// /Brands and /Reels_technologies pages enrich these rows in a later phase).

// Stable per-category slug uniqueness — genuinely distinct items can collapse to
// one slug (a DLC edition sharing a model name; a Cyrillic "Х" stripped by
// slugify). Suffix repeats (`-2`, `-3`) by parse order so the upsert keeps both.
function uniqueSlugs<T extends { slug: string }>(items: T[]): T[] {
  const seen = new Map<string, number>()
  for (const it of items) {
    const n = (seen.get(it.slug) ?? 0) + 1
    seen.set(it.slug, n)
    if (n > 1) it.slug = `${it.slug}-${n}`
  }
  return items
}

function main() {
  const species: ParsedSpecies[] = []
  const reels: ParsedReel[] = []
  const rods: ParsedRod[] = []
  const lines: ParsedLine[] = []
  const hooks: ParsedHook[] = []
  const sinkers: ParsedSinker[] = []
  const bobbers: ParsedBobber[] = []
  const lures: ParsedLure[] = []
  const baits: ParsedBait[] = []
  const boilies: ParsedBoilie[] = []
  const groundbaits: ParsedGroundbait[] = []
  const equipment: ParsedEquipment[] = []
  const transport: ParsedTransport[] = []
  const other: ParsedOther[] = []
  const pageBrands: ParsedBrand[] = []
  const pageTechs: ParsedTechnology[] = []

  for (const p of allPages()) {
    if (p.status !== 200) continue
    const sub = p.subtype ?? ''
    if (p.category === 'species') species.push(parseSpecies(p.markdown, p.url))
    else if (p.category === 'reels') reels.push(...parseReels(p.markdown, p.url, (sub || 'spinning') as ReelSubtype))
    else if (p.category === 'rods') rods.push(...parseRods(p.markdown, p.url, sub))
    else if (p.category === 'lines') lines.push(...parseLines(p.markdown, p.url, sub))
    else if (p.category === 'hooks') hooks.push(...parseHooks(p.markdown, p.url, sub))
    else if (p.category === 'sinkers') sinkers.push(...parseSinkers(p.markdown, p.url, sub))
    else if (p.category === 'bobbers') bobbers.push(...parseBobbers(p.markdown, p.url, sub))
    else if (p.category === 'lures') lures.push(...parseLures(p.markdown, p.url, sub))
    // Baits pages carry both layouts (flat one-row items + block-per-model boilies,
    // mixed on Event_Baits), so run each parser — the other's rows never match.
    else if (p.category === 'baits') {
      baits.push(...parseBaits(p.markdown, p.url, sub))
      boilies.push(...parseBoilies(p.markdown, p.url, sub))
    }
    // Groundbaits also mix layouts: flat catalogs (aromas/particles) + block-per-
    // model mixes (carp/base/method-mix). Each parser matches only its own shape.
    else if (p.category === 'groundbaits') {
      groundbaits.push(...parseGroundbaits(p.markdown, p.url, sub))
      groundbaits.push(...parseGroundbaitMixes(p.markdown, p.url, sub))
    }
    // Equipment: 6 flat catalog pages + the stringers-and-keepnets block page.
    else if (p.category === 'equipment') {
      equipment.push(...parseEquipment(p.markdown, p.url, sub))
      if (sub === 'stringers-and-keepnets') equipment.push(...parseStringersKeepnets(p.markdown, p.url, 'stringers-keepnets'))
    }
    else if (p.category === 'transport') transport.push(...parseTransport(p.markdown, p.url, sub))
    else if (p.category === 'other') other.push(...parseOther(p.markdown, p.url, sub))
    // Dedicated Brands / Technologies index pages enrich the derived rows below.
    else if (p.category === 'brands') pageBrands.push(...parseBrands(p.markdown, p.url))
    else if (p.category === 'technologies') pageTechs.push(...parseTechnologies(p.markdown, /Rods_technologies/.test(p.url) ? 'rod' : 'reel'))
  }

  // Brands (reels/rods/lines/hooks/sinkers) + technologies (reels/rods) are derived
  // (name-only) from the items that reference them, then enriched with description/
  // imageUrl from the dedicated /Brands + /*_technologies pages (overlay below).
  const brands = new Map<string, ParsedBrand>()
  const technologies = new Map<string, ParsedTechnology>()
  const addBrand = (b: WikiLink | null) => {
    if (b && !brands.has(b.slug)) brands.set(b.slug, { slug: b.slug, name: b.name, description: null, imageUrl: null, sourceUrl: null, contentHash: null })
  }
  const addTechs = (ts: WikiLink[]) => {
    for (const t of ts) if (!technologies.has(t.slug)) technologies.set(t.slug, { slug: t.slug, name: t.name, description: null, category: 'reel' })
  }
  for (const r of reels) {
    addBrand(r.brand)
    addTechs(r.technologies)
  }
  for (const r of rods) {
    addBrand(r.brand)
    addTechs(r.technologies)
  }
  for (const l of lines) addBrand(l.brand)
  for (const h of hooks) addBrand(h.brand)
  for (const s of sinkers) addBrand(s.brand)

  // Overlay the dedicated /Brands + /*_technologies pages onto the name-only rows
  // derived above (fill description/imageUrl); add any brand/tech only on those pages.
  for (const b of pageBrands) {
    const existing = brands.get(b.slug)
    if (existing) Object.assign(existing, { description: b.description, imageUrl: b.imageUrl, sourceUrl: b.sourceUrl, contentHash: b.contentHash })
    else brands.set(b.slug, b)
  }
  for (const t of pageTechs) {
    const existing = technologies.get(t.slug)
    // The dedicated page carries the proper tech name (e.g. "MicroLite® Frame Alloy");
    // the gear-derived name is a truncated icon-alt description, so prefer the page's.
    if (existing) Object.assign(existing, { name: t.name || existing.name, description: t.description, category: t.category })
    else technologies.set(t.slug, { slug: t.slug, name: t.name || t.slug, description: t.description, category: t.category })
  }

  const dataset: ParsedDataset = {
    species,
    reels,
    rods: uniqueSlugs(rods),
    lines: uniqueSlugs(lines),
    hooks: uniqueSlugs(hooks),
    sinkers: uniqueSlugs(sinkers),
    bobbers: uniqueSlugs(bobbers),
    lures: uniqueSlugs(lures),
    baits: uniqueSlugs(baits),
    boilies: uniqueSlugs(boilies),
    groundbaits: uniqueSlugs(groundbaits),
    equipment: uniqueSlugs(equipment),
    transport: uniqueSlugs(transport),
    other: uniqueSlugs(other),
    brands: [...brands.values()],
    technologies: [...technologies.values()],
  }
  mkdirSync(CACHE_DIR, { recursive: true })
  const out = join(CACHE_DIR, 'parsed.json')
  writeFileSync(out, JSON.stringify(dataset, null, 2))
  const variants = (arr: Array<{ variants?: unknown[] }>) => arr.reduce((s, x) => s + (x.variants?.length ?? 0), 0)
  console.log(
    `✓ parsed: ${species.length} species, ${reels.length} reels, ${rods.length} rods (${variants(rods)} variants), ` +
      `${lines.length} lines (${variants(lines)} variants), ${hooks.length} hooks (${variants(hooks)} variants), ` +
      `${sinkers.length} sinkers (${variants(sinkers)} variants), ${bobbers.length} bobbers, ${lures.length} lures (${variants(lures)} variants), ` +
      `${baits.length} baits, ${boilies.length} boilies, ${groundbaits.length} groundbaits, ${equipment.length} equipment, ` +
      `${transport.length} transport, ${other.length} other, ` +
      `${dataset.brands.length} brands, ${dataset.technologies.length} technologies → ${out}`,
  )
}

main()
