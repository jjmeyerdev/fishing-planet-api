import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../src/db.js'
import { CACHE_DIR } from './lib/cache.js'
import type { ParsedDataset } from './lib/types.js'

// Stage 3: upsert the parsed dataset into the wiki_* tables (Neon). Idempotent —
// entities upsert on their slug; child rows (variants, links) are replaced per
// parent. Brands/technologies load first so reels resolve their FKs by slug.
//
//   pnpm wiki:load   (after pnpm wiki:parse)

async function main() {
  const data: ParsedDataset = JSON.parse(readFileSync(join(CACHE_DIR, 'parsed.json'), 'utf8'))

  // 1. Brands / technologies (derived from reels; dedicated pages enrich later)
  for (const b of data.brands) {
    await prisma.wikiBrand.upsert({
      where: { slug: b.slug },
      create: { slug: b.slug, name: b.name, description: b.description, imageUrl: b.imageUrl },
      update: { name: b.name },
    })
  }
  const brandId = new Map((await prisma.wikiBrand.findMany({ select: { id: true, slug: true } })).map((b) => [b.slug, b.id]))

  for (const t of data.technologies) {
    await prisma.wikiTechnology.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, name: t.name, description: t.description, category: t.category },
      update: { name: t.name },
    })
  }
  const techId = new Map((await prisma.wikiTechnology.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]))

  // 2. Species + their unresolved cross-category links (replaced per species)
  for (const s of data.species) {
    const fields = {
      name: s.name,
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
    const row = await prisma.wikiSpecies.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...fields }, update: fields })
    await prisma.$transaction([
      prisma.wikiSpeciesBait.deleteMany({ where: { speciesId: row.id } }),
      prisma.wikiSpeciesBait.createMany({ data: s.baits.map((l) => ({ speciesId: row.id, name: l.name, slug: l.slug })), skipDuplicates: true }),
      prisma.wikiSpeciesLure.deleteMany({ where: { speciesId: row.id } }),
      prisma.wikiSpeciesLure.createMany({ data: s.lures.map((l) => ({ speciesId: row.id, name: l.name, slug: l.slug })), skipDuplicates: true }),
      prisma.wikiSpeciesLocation.deleteMany({ where: { speciesId: row.id } }),
      prisma.wikiSpeciesLocation.createMany({ data: s.locations.map((l) => ({ speciesId: row.id, name: l.name, slug: l.slug })), skipDuplicates: true }),
    ])
  }

  // 3. Reels + variants + technology links (brand/tech resolved by slug)
  let unresolvedTech = 0
  for (const r of data.reels) {
    const fields = {
      name: r.name,
      subtype: r.subtype,
      brandId: r.brand ? (brandId.get(r.brand.slug) ?? null) : null,
      description: r.description,
      imageUrl: r.imageUrl,
      sourceUrl: r.sourceUrl,
      contentHash: r.contentHash,
      scrapedAt: new Date(),
    }
    const row = await prisma.wikiReel.upsert({ where: { slug: r.slug }, create: { slug: r.slug, ...fields }, update: fields })
    const techLinks = r.technologies
      .map((t) => techId.get(t.slug))
      .filter((id): id is number => id != null)
      .map((technologyId) => ({ reelId: row.id, technologyId }))
    unresolvedTech += r.technologies.length - techLinks.length
    await prisma.$transaction([
      prisma.wikiReelVariant.deleteMany({ where: { reelId: row.id } }),
      prisma.wikiReelVariant.createMany({ data: r.variants.map((v) => ({ reelId: row.id, ...v })) }),
      prisma.wikiReelTechnology.deleteMany({ where: { reelId: row.id } }),
      prisma.wikiReelTechnology.createMany({ data: techLinks, skipDuplicates: true }),
    ])
  }

  console.log(
    `✓ loaded: ${data.species.length} species, ${data.reels.length} reels, ${data.brands.length} brands, ${data.technologies.length} technologies` +
      (unresolvedTech ? ` (${unresolvedTech} reel→tech links unresolved)` : ''),
  )
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
