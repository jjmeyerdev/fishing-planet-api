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
  const brandOf = (b: { slug: string } | null) => (b ? (brandId.get(b.slug) ?? null) : null)

  // 4. Rods — parent + variants + technology links (brand/tech resolved by slug).
  for (const r of data.rods) {
    const fields = {
      name: r.name, subtype: r.subtype, brandId: brandOf(r.brand), description: r.description, imageUrl: r.imageUrl,
      power: r.power, action: r.action, lineWeightLb: r.lineWeightLb, lineWeightKg: r.lineWeightKg,
      electric: r.electric, quiverTips: r.quiverTips, sourceUrl: r.sourceUrl, contentHash: r.contentHash, scrapedAt: new Date(),
    }
    const row = await prisma.wikiRod.upsert({ where: { slug: r.slug }, create: { slug: r.slug, ...fields }, update: fields })
    const techLinks = r.technologies.map((t) => techId.get(t.slug)).filter((id): id is number => id != null).map((technologyId) => ({ rodId: row.id, technologyId }))
    unresolvedTech += r.technologies.length - techLinks.length
    await prisma.$transaction([
      prisma.wikiRodVariant.deleteMany({ where: { rodId: row.id } }),
      prisma.wikiRodVariant.createMany({ data: r.variants.map((v) => ({ rodId: row.id, ...v })) }),
      prisma.wikiRodTechnology.deleteMany({ where: { rodId: row.id } }),
      prisma.wikiRodTechnology.createMany({ data: techLinks, skipDuplicates: true }),
    ])
  }

  // 5. Lines — parent + (diameter × spool) variants.
  for (const l of data.lines) {
    const fields = { name: l.name, subtype: l.subtype, kind: l.kind, brandId: brandOf(l.brand), description: l.description, color: l.color, sourceUrl: l.sourceUrl, contentHash: l.contentHash, scrapedAt: new Date() }
    const row = await prisma.wikiLine.upsert({ where: { slug: l.slug }, create: { slug: l.slug, ...fields }, update: fields })
    await prisma.$transaction([
      prisma.wikiLineVariant.deleteMany({ where: { lineId: row.id } }),
      prisma.wikiLineVariant.createMany({ data: l.variants.map((v) => ({ lineId: row.id, ...v })) }),
    ])
  }

  // 6. Hooks — parent + variants (plain hooks + jig heads, kind discriminator).
  for (const h of data.hooks) {
    const fields = { name: h.name, kind: h.kind, subtype: h.subtype, brandId: brandOf(h.brand), type: h.type, color: h.color, sharpening: h.sharpening, count: h.count, description: h.description, imageUrl: h.imageUrl, sourceUrl: h.sourceUrl, contentHash: h.contentHash, scrapedAt: new Date() }
    const row = await prisma.wikiHook.upsert({ where: { slug: h.slug }, create: { slug: h.slug, ...fields }, update: fields })
    await prisma.$transaction([
      prisma.wikiHookVariant.deleteMany({ where: { hookId: row.id } }),
      prisma.wikiHookVariant.createMany({ data: h.variants.map((v) => ({ hookId: row.id, ...v })) }),
    ])
  }

  // 7. Sinkers & feeders — parent + variants (kind discriminator).
  for (const s of data.sinkers) {
    const fields = { name: s.name, kind: s.kind, subtype: s.subtype, brandId: brandOf(s.brand), description: s.description, imageUrl: s.imageUrl, sourceUrl: s.sourceUrl, contentHash: s.contentHash, scrapedAt: new Date() }
    const row = await prisma.wikiSinker.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...fields }, update: fields })
    await prisma.$transaction([
      prisma.wikiSinkerVariant.deleteMany({ where: { sinkerId: row.id } }),
      prisma.wikiSinkerVariant.createMany({ data: s.variants.map((v) => ({ sinkerId: row.id, ...v })) }),
    ])
  }

  // 8. Bobbers — one row per item (no variant child).
  for (const b of data.bobbers) {
    const fields = {
      name: b.name, subtype: b.subtype, section: b.section, fpId: b.fpId, imageUrl: b.imageUrl, description: b.description,
      color: b.color, size: b.size, shape: b.shape, maxFloatingWeight: b.maxFloatingWeight, sensitivity: b.sensitivity, material: b.material,
      unlockLevel: b.unlockLevel, priceCredits: b.priceCredits, priceBaitcoins: b.priceBaitcoins, priceNote: b.priceNote,
      sourceUrl: b.sourceUrl, contentHash: b.contentHash, scrapedAt: new Date(),
    }
    await prisma.wikiBobber.upsert({ where: { slug: b.slug }, create: { slug: b.slug, ...fields }, update: fields })
  }

  // 9. Lures — parent + (color × size) variants.
  for (const l of data.lures) {
    const fields = { name: l.name, subtype: l.subtype, description: l.description, sourceUrl: l.sourceUrl, contentHash: l.contentHash, scrapedAt: new Date() }
    const row = await prisma.wikiLure.upsert({ where: { slug: l.slug }, create: { slug: l.slug, ...fields }, update: fields })
    await prisma.$transaction([
      prisma.wikiLureVariant.deleteMany({ where: { lureId: row.id } }),
      prisma.wikiLureVariant.createMany({ data: l.variants.map((v) => ({ lureId: row.id, ...v })) }),
    ])
  }

  // 10. Baits — flat consumable catalog (no variants/links).
  for (const b of data.baits) {
    const fields = {
      name: b.name, subtype: b.subtype, fpId: b.fpId, imageUrl: b.imageUrl, description: b.description,
      targetFish: b.targetFish, quantity: b.quantity, weightClass: b.weightClass, unlockLevel: b.unlockLevel, hookSize: b.hookSize,
      priceCredits: b.priceCredits, priceBaitcoins: b.priceBaitcoins, priceNote: b.priceNote,
      sourceUrl: b.sourceUrl, contentHash: b.contentHash, scrapedAt: new Date(),
    }
    await prisma.wikiBait.upsert({ where: { slug: b.slug }, create: { slug: b.slug, ...fields }, update: fields })
  }

  // 11. Boilies & pellets — flattened block-per-model items.
  for (const b of data.boilies) {
    const fields = {
      name: b.name, subtype: b.subtype, fpId: b.fpId, imageUrl: b.imageUrl, boilImageUrl: b.boilImageUrl, description: b.description,
      sizeIn: b.sizeIn, sizeMm: b.sizeMm, targetFish: b.targetFish, flavour: b.flavour, color: b.color, buoyancy: b.buoyancy,
      weightClass: b.weightClass, quantity: b.quantity, unlockLevel: b.unlockLevel,
      priceCredits: b.priceCredits, priceBaitcoins: b.priceBaitcoins, priceNote: b.priceNote,
      sourceUrl: b.sourceUrl, contentHash: b.contentHash, scrapedAt: new Date(),
    }
    await prisma.wikiBoilie.upsert({ where: { slug: b.slug }, create: { slug: b.slug, ...fields }, update: fields })
  }

  console.log(
    `✓ loaded: ${data.species.length} species, ${data.reels.length} reels, ${data.rods.length} rods, ${data.lines.length} lines, ` +
      `${data.hooks.length} hooks, ${data.sinkers.length} sinkers, ${data.bobbers.length} bobbers, ${data.lures.length} lures, ` +
      `${data.baits.length} baits, ${data.boilies.length} boilies, ` +
      `${data.brands.length} brands, ${data.technologies.length} technologies` +
      (unresolvedTech ? ` (${unresolvedTech} rod/reel→tech links unresolved)` : ''),
  )
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
