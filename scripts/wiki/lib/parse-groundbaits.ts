import { createHash } from 'node:crypto'
import type { ParsedGroundbait } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { foldRows, iconId, norm, pick, priceOf } from './gear.js'

// Groundbaits come in two page layouts, both flattened to one row per product:
//  - FLAT (aromas, particles): a wide catalog table keyed off a `Picture/Name`
//    header. Columns differ per page (aromas has Aroma+Effect, particles has
//    Contains), so map by header label. The image + name share the first cell
//    (`[![img]]()<br>Name`, like bobbers), and there is a `/Brands` link column.
//  - MIX (carp-groundbaits, groundbait-base, method-mix-groundbaits): the
//    block-per-model shape (like boilies) — a `| Name | v1 … |` row sets the
//    variant axis; foldRows/pick handle broadcast + the (mm)/(kg) unit sub-rows.
//    Labels vary per page (carp: Size/Flavour/Color; base: Aroma/Grain/Density).
// Both emit ParsedGroundbait into one table; off-subtype columns stay null.

const IMAGE = /!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/
const imgUrl = (cell: string | null): string | null => cell?.match(IMAGE)?.[1] ?? null
const brandName = (cell: string): string | null => stripMd(cell.match(/\[([^\]]+)\]\([^)]*Brands[^)]*\)/)?.[1] ?? '') || null

const EMPTY = {
  brand: null, description: null, temperature: null, aroma: null, effect: null, contains: null,
  flavour: null, color: null, grain: null, density: null, ponds: null, nutritionValue: null, sizeMm: null,
} as const

// Flat catalog pages (aromas, particles).
export function parseGroundbaits(markdown: string, sourceUrl: string, subtype: string): ParsedGroundbait[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const hi = lines.findIndex((l) => /^\|\s*Picture\/Name\s*\|/i.test(l))
  if (hi < 0) return []
  const headers = tableCells(lines[hi]).map((h) => norm(h).toLowerCase())
  const at = (name: string): number => headers.indexOf(name)
  const idx = {
    fish: at('fish'), weather: at('weather conditions'), aroma: at('aroma'), effect: at('effect'),
    contains: at('contains'), weight: headers.findIndex((h) => /^weight/.test(h)),
    price: at('price'), level: at('required level'), brand: at('brand'), desc: at('description'),
  }
  const get = (c: string[], i: number): string => (i >= 0 ? stripMd(c[i] ?? '') : '')

  const out: ParsedGroundbait[] = []
  for (const raw of lines.slice(hi + 1)) {
    if (!raw.trim().startsWith('|')) continue
    const c = tableCells(raw)
    if (c.length < headers.length - 1) continue
    const img = c[0].match(IMAGE)
    if (!img) continue // separator / non-item row
    const imageUrl = img[1]
    const name = (stripMd(c[0].split(/<br\s*\/?>/i).pop() ?? '') || (c[0].match(/!\[([^\]]*)\]/)?.[1] ?? '').replace(/\.png$/i, '').replace(/_/g, ' ')).trim()
    if (!name) continue
    const fpId = iconId(imageUrl)
    out.push({
      ...EMPTY,
      slug: slugify(`${subtype} ${name} ${fpId ?? ''}`),
      name,
      subtype,
      fpId,
      imageUrl,
      brand: idx.brand >= 0 ? brandName(c[idx.brand] ?? '') : null,
      description: get(c, idx.desc) || null,
      targetFish: get(c, idx.fish).split(',').map((s) => s.trim()).filter(Boolean),
      temperature: get(c, idx.weather) || null,
      aroma: get(c, idx.aroma) || null,
      effect: get(c, idx.effect) || null,
      contains: get(c, idx.contains) || null,
      weight: get(c, idx.weight) || null,
      ...priceOf(idx.price >= 0 ? c[idx.price] ?? '' : ''),
      unlockLevel: num(get(c, idx.level)),
      sourceUrl,
      contentHash,
    })
  }
  return out
}

// Block-per-model mix pages (carp-groundbaits, groundbait-base, method-mix-groundbaits).
export function parseGroundbaitMixes(markdown: string, sourceUrl: string, subtype: string): ParsedGroundbait[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const anchors = lines.map((l, i) => (/^\|\s*Name\s*\|/i.test(l) ? i : -1)).filter((i) => i >= 0)
  const out: ParsedGroundbait[] = []

  anchors.forEach((start, k) => {
    const block = lines.slice(start, k + 1 < anchors.length ? anchors[k + 1] : lines.length)
    const F = foldRows(block.map(tableCells))
    const names = F.get('Name')
    if (!names || names.length === 0) return
    const n = names.length
    for (let j = 0; j < n; j++) {
      const name = norm(names[j])
      if (!name) continue
      const imageUrl = imgUrl(pick(F, 'Picture', j, n))
      out.push({
        ...EMPTY,
        slug: slugify(`${subtype} ${name} ${imageUrl ? iconId(imageUrl) ?? '' : ''}`),
        name,
        subtype,
        fpId: imageUrl ? iconId(imageUrl) : null,
        imageUrl,
        targetFish: (pick(F, 'Target Fish', j, n) ?? '').split(',').map((s) => stripMd(s)).filter(Boolean),
        temperature: pick(F, 'Temperature', j, n),
        aroma: pick(F, 'Aroma', j, n),
        flavour: pick(F, 'Flavour', j, n),
        color: pick(F, 'Color', j, n),
        grain: pick(F, 'Grain', j, n),
        density: pick(F, 'Density', j, n),
        ponds: pick(F, 'Ponds', j, n),
        nutritionValue: pick(F, 'Nutrition Value', j, n),
        sizeMm: pick(F, 'Size::(mm)', j, n),
        weight: pick(F, 'Weight::(kg)', j, n),
        ...priceOf(pick(F, 'Price', j, n) ?? ''),
        unlockLevel: num(pick(F, 'Required level', j, n)),
        sourceUrl,
        contentHash,
      })
    }
  })
  return out
}
