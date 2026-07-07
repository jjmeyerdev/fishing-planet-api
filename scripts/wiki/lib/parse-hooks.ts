import { createHash } from 'node:crypto'
import type { ParsedHook, ParsedHookVariant } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { brandAndName, firstImage, foldRows, norm, pick, priceOf } from './gear.js'

// Parse a hook sub-type page into one record per model. Two structurally different
// families (chosen by subtype):
//   • plain hooks (simple/offset/carp/saltwater) — a reels-style brand block with a
//     transposed spec table (Size columns are the variants; Type/Color/Sharpening/
//     Count are single model-level values).
//   • jig heads (common / common-saltwater) — a `## **Name**` section with one table
//     row per (weight, hook-size) variant; no brand.

const HEADER = /^\|\s*\[[^\]]+\]\([^)]*Brands[^)]*\)\s*\*\*[^*]+\*\*\s*\|/

export function parseHooks(markdown: string, sourceUrl: string, subtype: string): ParsedHook[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  return subtype.includes('jig-heads')
    ? parseJigHeads(markdown, sourceUrl, subtype, contentHash)
    : parsePlainHooks(markdown, sourceUrl, subtype, contentHash)
}

function parsePlainHooks(markdown: string, sourceUrl: string, subtype: string, contentHash: string): ParsedHook[] {
  const lines = markdown.split('\n')
  const heads = lines.map((l, i) => (HEADER.test(l) ? i : -1)).filter((i) => i >= 0)
  return heads.map((start, k) => {
    const block = lines.slice(start, k + 1 < heads.length ? heads[k + 1] : lines.length)
    const { brand, name } = brandAndName(block[0])

    let description: string | null = null
    for (const l of block.slice(1)) {
      const t = l.trim()
      if (t && !t.startsWith('|') && !t.startsWith('#') && !t.startsWith('* * *')) {
        description = stripMd(t)
        break
      }
    }

    const F = foldRows(block.map(tableCells))
    const sizes = F.get('Size') ?? [null as unknown as string]
    const n = sizes.length
    const variants: ParsedHookVariant[] = sizes.map((size, j) => ({
      size: size ? norm(size) : null,
      weightOz: null,
      weightG: null,
      ...priceOf(pick(F, 'Price', j, n) ?? ''),
      unlockLevel: num(pick(F, 'Required level', j, n)),
      imageUrl: imageOf(pick(F, 'Picture', j, n)),
    }))

    const single = (key: string): string | null => {
      const v = F.get(key)
      return v?.[0] ? norm(v[0]) : null
    }
    return {
      slug: slugify(`${subtype} ${brand?.name ?? ''} ${name}`),
      name,
      kind: 'hook',
      subtype,
      brand,
      type: single('Type'),
      color: single('Color'),
      sharpening: single('Sharpening'),
      count: num(single('Count')),
      description,
      imageUrl: imageOf(F.get('Hook')?.[0]) ?? firstImage(block),
      variants,
      sourceUrl,
      contentHash,
    }
  })
}

function parseJigHeads(markdown: string, sourceUrl: string, subtype: string, contentHash: string): ParsedHook[] {
  const out: ParsedHook[] = []
  for (const part of markdown.split(/^##\s+/m).slice(1)) {
    const nl = part.indexOf('\n')
    const name = stripMd(nl < 0 ? part : part.slice(0, nl))
    if (!name || /^contents$/i.test(name)) continue
    const body = nl < 0 ? [] : part.slice(nl + 1).split('\n')

    let description: string | null = null
    const variants: ParsedHookVariant[] = []
    for (const l of body) {
      const t = l.trim()
      if (!t.startsWith('|')) {
        if (!description && t && !t.startsWith('#')) description = stripMd(t)
        continue
      }
      const cells = tableCells(l)
      if (!/!\[/.test(cells[0] ?? '')) continue // skip header / rule rows (data rows lead with an image)
      // columns: Picture | Weight(Oz / g) | Hook | Required level | Price
      const weight = cells[1] ?? ''
      variants.push({
        size: cells[2] ? norm(cells[2]) : null,
        weightOz: weight.match(/^(.*?)\s*Oz/i)?.[1]?.trim() || null,
        weightG: num(weight.match(/([\d.]+)\s*g\b/i)?.[1]),
        ...priceOf(cells[4] ?? ''),
        unlockLevel: num(cells[3]),
        imageUrl: imageOf(cells[0]),
      })
    }
    if (variants.length === 0) continue

    out.push({
      slug: slugify(`${subtype} ${name}`),
      name,
      kind: 'jighead',
      subtype,
      brand: null,
      type: null,
      color: null,
      sharpening: null,
      count: null,
      description,
      imageUrl: variants[0]?.imageUrl ?? null,
      variants,
      sourceUrl,
      contentHash,
    })
  }
  return out
}

function imageOf(cell: string | null | undefined): string | null {
  if (!cell) return null
  const m = cell.match(/!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/)
  return m && !/Credits|Baitcoins/i.test(m[1]) ? m[1] : null
}
