import { createHash } from 'node:crypto'
import type { ParsedEquipment } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { foldRows, iconId, norm, priceOf } from './gear.js'

// Equipment spans two page shapes, both → one wide wiki_equipment table:
//  - FLAT (glasses, hats, rod-cases, tackle-boxes, waist-coats, rod-holders): a
//    catalog table whose columns differ per page, so map by header label. Name is
//    a `Model` column (glasses) or the combined `Picture/Name` cell (`<br>Name`).
//  - BLOCK (stringers-and-keepnets): each product is a `**Name**` header (with an
//    optional /Brands link) + description + image + a `| Name | v1 … |` spec block
//    (max fish weights, durability, …). foldRows/pick flatten per variant.
// Subtype-specific columns stay null off-subtype.

const IMAGE = /!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/
const brandName = (cell: string): string | null => stripMd(cell.match(/\[([^\]]+)\]\([^)]*Brands[^)]*\)/)?.[1] ?? '') || null

const EMPTY = {
  brand: null, description: null, material: null, color: null, tackles: null, flashlight: null,
  flashlightSlot: null, storageCapacity: null, rodSlot: null, standCount: null, biteAlarm: null,
  weight: null, maxSingleFishWeightKg: null, maxTotalFishWeightKg: null,
  fishFriendly: null, durability: null,
} as const

// Flat catalog pages.
export function parseEquipment(markdown: string, sourceUrl: string, subtype: string): ParsedEquipment[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const hi = lines.findIndex((l) => l.startsWith('|') && /required level/i.test(l) && /price/i.test(l) && /(picture|name|model)/i.test(l))
  if (hi < 0) return []
  const H = tableCells(lines[hi]).map((h) => norm(h).toLowerCase())
  const find = (re: RegExp): number => H.findIndex((h) => re.test(h))
  const idx = {
    picture: find(/picture/), model: H.indexOf('model'), color: H.indexOf('color'), material: H.indexOf('material'),
    tackles: H.indexOf('tackles'), flashlight: H.indexOf('flashlight'), flashlightSlot: find(/flashlight slot/),
    storage: find(/storage capacity/), rodSlot: find(/rod slot/), standCount: find(/stand count/), biteAlarm: find(/bite alarm/),
    weight: find(/^weight/), price: H.indexOf('price'), level: find(/required level/), brand: H.indexOf('brand'), desc: H.indexOf('description'),
  }

  const out: ParsedEquipment[] = []
  for (const raw of lines.slice(hi + 1)) {
    if (!raw.trim().startsWith('|')) continue
    const c = tableCells(raw)
    if (c.length < H.length - 1) continue
    const picCell = c[idx.picture >= 0 ? idx.picture : 0] ?? ''
    const img = picCell.match(IMAGE)
    if (!img) continue // header / separator
    const g = (i: number): string => (i >= 0 ? stripMd((c[i] ?? '').replace(/<br\s*\/?>/gi, '; ')) : '')
    const imageUrl = img[1]
    const name =
      idx.model >= 0
        ? stripMd(c[idx.model] ?? '')
        : stripMd((picCell.split(/<br\s*\/?>/i).pop() ?? '') || (picCell.match(/!\[([^\]]*)\]/)?.[1] ?? '').replace(/\.png$/i, '').replace(/_/g, ' '))
    if (!name.trim()) continue
    const fpId = iconId(imageUrl)
    out.push({
      ...EMPTY,
      slug: slugify(`${subtype} ${name} ${fpId ?? ''}`),
      name: name.trim(),
      subtype,
      fpId,
      imageUrl,
      brand: idx.brand >= 0 ? brandName(c[idx.brand] ?? '') : null,
      description: g(idx.desc) || null,
      material: g(idx.material) || null,
      color: g(idx.color) || null,
      tackles: g(idx.tackles) || null,
      flashlight: g(idx.flashlight) || null,
      flashlightSlot: g(idx.flashlightSlot) || null,
      storageCapacity: g(idx.storage) || null,
      rodSlot: g(idx.rodSlot) || null,
      standCount: g(idx.standCount) || null,
      biteAlarm: g(idx.biteAlarm) || null,
      weight: g(idx.weight) || null,
      ...priceOf(idx.price >= 0 ? c[idx.price] ?? '' : ''),
      unlockLevel: num(g(idx.level)),
      sourceUrl,
      contentHash,
    })
  }
  return out
}

// The stringers-and-keepnets page: `**Name**` header + spec block per product.
const isHeader = (l: string): boolean => {
  const c = tableCells(l)
  return c.length === 1 && /\*\*[^*]+\*\*/.test(c[0]) && !/^\|\s*Name\s*\|/i.test(l)
}

export function parseStringersKeepnets(markdown: string, sourceUrl: string, subtype: string): ParsedEquipment[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const heads = lines.map((l, i) => (isHeader(l) ? i : -1)).filter((i) => i >= 0)
  const out: ParsedEquipment[] = []

  heads.forEach((start, k) => {
    const section = lines.slice(start, k + 1 < heads.length ? heads[k + 1] : lines.length)
    const nameRow = section.findIndex((l) => /^\|\s*Name\s*\|/i.test(l))
    if (nameRow < 0) return // header with no spec block

    const headerCell = tableCells(section[0])[0] ?? ''
    const name = (headerCell.match(/\*\*([^*]+)\*\*/)?.[1] ?? stripMd(headerCell)).trim()
    if (!name) return
    const brand = brandName(headerCell)
    const description = section.slice(1, nameRow).map(stripMd).find((t) => t.length > 25) ?? null
    const imageUrl = section.map((l) => l.match(IMAGE)?.[1]).find(Boolean) ?? null
    const fpId = imageUrl ? iconId(imageUrl) : null

    // The spec block is a merged-cell (model × size) grid — the model names, sizes,
    // and per-size weights don't line up 1:1, so we can't split it into clean
    // per-variant rows. Emit one row per product (the header) with the shared
    // fields, and fold the per-size weight columns into a min–max range.
    const F = foldRows(section.slice(nameRow).map(tableCells))
    const vals = (key: string): string[] => F.get(key) ?? []
    const uniq = (key: string): string | null => {
      const v = [...new Set(vals(key).map(norm).filter(Boolean))]
      return v.length ? v.join(' / ') : null
    }
    const range = (key: string): string | null => {
      const ns = vals(key).map((x) => Number(norm(x))).filter((x) => Number.isFinite(x))
      if (!ns.length) return null
      const lo = Math.min(...ns)
      const hi = Math.max(...ns)
      return lo === hi ? String(lo) : `${lo} - ${hi}`
    }
    const note = vals('Price').map((c) => priceOf(c).priceNote).find(Boolean) ?? null

    out.push({
      ...EMPTY,
      slug: slugify(`${subtype} ${name} ${fpId ?? ''}`),
      name,
      subtype,
      fpId,
      imageUrl,
      brand,
      description,
      material: uniq('Material'),
      fishFriendly: uniq('Fish-Friendly'),
      durability: uniq('Durability'),
      maxSingleFishWeightKg: range('Max. Single Fish Weight::(kg)'),
      maxTotalFishWeightKg: range('Max. Total Fish Weight::(kg)'),
      priceCredits: null, // per-size in the source grid — not a single product price
      priceBaitcoins: null,
      priceNote: note,
      unlockLevel: null,
      sourceUrl,
      contentHash,
    })
  })
  return out
}
