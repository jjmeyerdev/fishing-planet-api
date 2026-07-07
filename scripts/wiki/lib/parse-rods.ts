import { createHash } from 'node:crypto'
import type { ParsedRod, ParsedRodVariant, WikiLink } from './types.js'
import { num, stripMd, slugify, tableCells } from './markdown.js'
import { brandAndName, firstImage, foldRows, norm, pick, techsFromIcons } from './gear.js'

// Parse a rod sub-type page (/Spinning_rods, …) into one record per model. Reuses
// the reels block skeleton (brand-header → image → prose → "Technologies included"
// → spec table) but the spec table differs: variants are keyed by the `Length` row
// (or a `Name` row for DLC editions), and some spec rows are shared (one value
// broadcast to every variant) rather than per-variant.

const HEADER = /^\|\s*\[[^\]]+\]\([^)]*Brands[^)]*\)\s*\*\*[^*]+\*\*\s*\|/

export function parseRods(markdown: string, sourceUrl: string, subtype: string): ParsedRod[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const heads = lines.map((l, i) => (HEADER.test(l) ? i : -1)).filter((i) => i >= 0)
  return heads.map((start, k) => parseBlock(lines.slice(start, k + 1 < heads.length ? heads[k + 1] : lines.length), sourceUrl, subtype, contentHash))
}

function parseBlock(block: string[], sourceUrl: string, subtype: string, contentHash: string): ParsedRod {
  const { brand, name } = brandAndName(block[0])
  const imageUrl = firstImage(block)

  let description: string | null = null
  for (const l of block.slice(1)) {
    const cells = tableCells(l)
    if (cells.length === 1) {
      const t = stripMd(cells[0])
      if (t.length > 40 && !/Technologies included/i.test(t)) {
        description = t
        break
      }
    }
  }

  const technologies = techsFromIcons(block, /^\|\s*(Length|Name)\b/i)
  const F = foldRows(block.map(tableCells))

  // Variant axis: named DLC editions if present, else the length list.
  const names = F.get('Name') ?? F.get('Length') ?? [null as unknown as string]
  const n = names.length
  // "Lure weight" | "Casting Weight" | "Lure Weight" are one logical field.
  const lwKey = ['Lure weight', 'Casting Weight', 'Lure Weight'].find((k) => F.has(k))
  const lineShared = (F.get('Line weight')?.length ?? 0) <= 1

  const variants: ParsedRodVariant[] = names.map((label, j) => {
    const pcell = pick(F, 'Price', j, n) ?? ''
    const dlc = /DLC/i.test(pcell)
    return {
      name: F.has('Name') ? (label ? norm(label) : null) : pick(F, 'Length', j, n),
      lengthFt: pick(F, 'Length', j, n),
      lengthM: pick(F, 'Length::(m)', j, n),
      lureWeightOz: lwKey ? pick(F, lwKey, j, n) : null,
      lureWeightG: lwKey ? pick(F, `${lwKey}::(g)`, j, n) : null,
      lineWeightLb: lineShared ? null : pick(F, 'Line weight', j, n),
      lineWeightKg: lineShared ? null : pick(F, 'Line weight::(kg)', j, n),
      pieces: pick(F, 'Pieces', j, n),
      guides: pick(F, 'Guides', j, n),
      unlockLevel: num(pick(F, 'Required level', j, n)),
      priceCredits: dlc || /Baitcoins/i.test(pcell) ? null : num(pcell),
      priceBaitcoins: /Baitcoins/i.test(pcell) ? num(pcell) : null,
      dlcPack: dlc ? stripMd(pcell).replace(/^DLC\s*/i, '').trim() || null : null,
    }
  })

  // Feeder rods append a quiver-tip sub-table (own oz/g columns) — a model-level list.
  const qOz = F.get('Quiver tip')
  const qG = F.get('Quiver tip::(g)')
  const quiverTips = qOz ? qOz.map((oz, i) => `${norm(oz)}oz/${qG?.[i] ? norm(qG[i]) : '?'}g`).join(', ') : null

  const single = (k: string): string | null => {
    const v = F.get(k)
    return v?.[0] ? norm(v[0]) : null
  }

  return {
    slug: slugify(`${subtype} ${brand?.name ?? ''} ${name}`),
    name,
    subtype,
    brand,
    description,
    imageUrl,
    power: single('Power'),
    action: single('Action'),
    lineWeightLb: lineShared ? single('Line weight') : null,
    lineWeightKg: lineShared ? single('Line weight::(kg)') : null,
    electric: F.has('Electric') ? true : null,
    quiverTips,
    technologies: technologies as WikiLink[],
    variants,
    sourceUrl,
    contentHash,
  }
}
