import { createHash } from 'node:crypto'
import type { ParsedSinker, ParsedSinkerVariant } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { brandAndName, firstImage, foldRows, norm, pick, priceOf } from './gear.js'

// Parse a "Sinker and Feeders" sub-type page into one record per item. Reels-style
// blocks (optional brand-header → prose → spec table with per-weight value columns),
// but one item can span MULTIPLE spec tables (capacity/size tiers, separated by
// `* * *`, the 2nd+ without a name header) — each tier's weight columns add more
// variants. Brand is rare; no technologies. `kind` = sinker | feeder from subtype.

// Item name row: a single-cell `| **Name** |`, optionally brand-linked.
const NAME = /^\|\s*(?:\[[^\]]+\]\([^)]*Brands[^)]*\)\s*)?\*\*[^*]+\*\*\s*\|\s*$/
const RULE = /^\s*\*\s*\*\s*\*\s*$/

export function parseSinkers(markdown: string, sourceUrl: string, subtype: string): ParsedSinker[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const kind = /sinker/i.test(subtype) ? 'sinker' : 'feeder'
  const lines = markdown.split('\n')
  const heads = lines.map((l, i) => (NAME.test(l) ? i : -1)).filter((i) => i >= 0)

  return heads.map((start, k) => {
    const block = lines.slice(start, k + 1 < heads.length ? heads[k + 1] : lines.length)
    const { brand, name } = brandAndName(block[0])

    let description: string | null = null
    for (const l of block.slice(1)) {
      const t = l.trim()
      if (t && !t.startsWith('|') && !t.startsWith('#') && !RULE.test(t)) {
        description = stripMd(t)
        break
      }
    }

    // Split the block into spec-table segments (capacity tiers), fold each, and
    // concatenate their per-weight variants.
    const variants: ParsedSinkerVariant[] = []
    let seg: string[] = []
    const consume = () => {
      if (seg.length) variants.push(...segmentVariants(seg))
      seg = []
    }
    for (const l of block.slice(1)) {
      if (RULE.test(l.trim())) consume()
      else seg.push(l)
    }
    consume()

    return {
      slug: slugify(`${subtype} ${brand?.name ?? ''} ${name}`),
      name,
      kind,
      subtype,
      brand,
      description,
      imageUrl: firstImage(block),
      variants,
      sourceUrl,
      contentHash,
    }
  })
}

function segmentVariants(seg: string[]): ParsedSinkerVariant[] {
  const F = foldRows(seg.map(tableCells))
  if (!['Price', 'Required level', 'Weight::(g)', 'Name', 'Capacity'].some((k) => F.has(k))) return []

  const keyArr = F.get('Weight::(g)') ?? F.get('Capacity::(kg)') ?? F.get('Name') ?? F.get('Price') ?? [null]
  const n = keyArr.length
  const catapult = F.has('Capacity::(kg)') // catapults key Capacity in lb/kg (numeric)

  return Array.from({ length: n }, (_, j): ParsedSinkerVariant => {
    // label fields are short text — strip any stray markdown (a PVA `Mesh`/`Bag`
    // row is actually an image, which would overflow the column).
    const txt = (k: string): string | null => {
      const v = pick(F, k, j, n)
      const t = v ? stripMd(v) : ''
      return t || null
    }
    return {
      weightG: num(pick(F, 'Weight::(g)', j, n)),
      weightOz: txt('Weight'),
      capacityKg: catapult ? num(pick(F, 'Capacity::(kg)', j, n)) : null,
      capacityLb: catapult ? txt('Capacity') : null,
      form: txt('Form'),
      count: num(pick(F, 'Count', j, n)),
      capacity: catapult ? null : txt('Capacity'),
      feederType: txt('Type'),
      dissolutionTime: txt('Dissolution Time'),
      variantName: txt('Name'),
      mesh: txt('Mesh'),
      range: txt('Range'),
      ...priceOf(pick(F, 'Price', j, n) ?? ''),
      unlockLevel: num(pick(F, 'Required level', j, n)),
      imageUrl: imageOf(pick(F, 'Picture', j, n)),
    }
  })
}

function imageOf(cell: string | null): string | null {
  if (!cell) return null
  const m = cell.match(/!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/)
  return m && !/Credits|Baitcoins/i.test(m[1]) ? m[1] : null
}
