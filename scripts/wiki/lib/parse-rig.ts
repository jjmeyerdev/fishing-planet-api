import { createHash } from 'node:crypto'
import type { ParsedRig } from './types.js'
import { slugify, stripMd, tableCells } from './markdown.js'
import { iconId, norm, UNIT } from './gear.js'

// Parse a Rig sub-type page (/Leaders, /Carolina_Rigs, /Texas_Rigs, /Three-way_Rigs)
// into one record per product line. The source is a transposed, badly-merged
// model×variant grid (a `**Name**` header, then Diameter/Test/Length/Color/Count/
// Required level/Price rows whose columns don't line up), so per-variant rows aren't
// recoverable — instead each `**Name**` block is summarised: numeric specs to a
// min–max range, discrete specs to a distinct list.

const IMAGE = /!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/
const brandName = (cell: string): string | null => stripMd(cell.match(/\[([^\]]+)\]\([^)]*Brands[^)]*\)/)?.[1] ?? '') || null
const isHeader = (l: string): boolean => {
  const c = tableCells(l)
  return c.length === 1 && /\*\*[^*]+\*\*/.test(c[0])
}

// All value cells under rows whose label matches, skipping any unit cell ((mm)/(lb.)).
function collect(section: string[], labelRe: RegExp): string[] {
  const out: string[] = []
  for (const raw of section) {
    const c = tableCells(raw)
    if (c.length < 2 || !labelRe.test(norm(c[0]).toLowerCase())) continue
    for (const cell of c.slice(1)) {
      const v = norm(cell)
      if (v && !UNIT.test(v)) out.push(v)
    }
  }
  return out
}
const numRange = (vals: string[]): string | null => {
  // First numeric token per cell — robust to a trailing currency icon on price cells.
  const ns = vals.map((v) => Number(norm(v).match(/[\d.]+/)?.[0])).filter((n) => Number.isFinite(n) && n > 0)
  if (!ns.length) return null
  const lo = Math.min(...ns)
  const hi = Math.max(...ns)
  return lo === hi ? String(lo) : `${lo} - ${hi}`
}
const uniqJoin = (vals: string[]): string | null => {
  const u = [...new Set(vals.map((v) => stripMd(v)).filter(Boolean))]
  return u.length ? u.join(' / ') : null
}

export function parseRig(markdown: string, sourceUrl: string, subtype: string): ParsedRig[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const heads = lines.map((l, i) => (isHeader(l) ? i : -1)).filter((i) => i >= 0)
  const out: ParsedRig[] = []

  heads.forEach((start, k) => {
    const section = lines.slice(start, k + 1 < heads.length ? heads[k + 1] : lines.length)
    // A product line must have spec rows (a Test/Diameter row) — skip stray bold headers.
    if (!section.some((l) => /^\|\s*(Test|Diameter)\b/i.test(l))) return
    const headerCell = tableCells(section[0])[0] ?? ''
    const name = (headerCell.match(/\*\*([^*]+)\*\*/)?.[1] ?? '').trim()
    if (!name) return
    const imageUrl = section.map((l) => l.match(IMAGE)?.[1]).find(Boolean) ?? null

    out.push({
      slug: slugify(`${subtype} ${name}`),
      name,
      subtype,
      fpId: imageUrl ? iconId(imageUrl) : null,
      imageUrl,
      brand: brandName(headerCell),
      diameterMm: numRange(collect(section, /^\(mm\)$/)),
      testLb: numRange(collect(section, /^test$/)),
      testKg: numRange(collect(section, /^\(kg\.?\)$/)),
      length: uniqJoin(collect(section, /^length|^\(m\.?\)$/)),
      colors: uniqJoin(collect(section, /^color$/)),
      count: uniqJoin(collect(section, /^count$/)),
      unlockLevel: numRange(collect(section, /^required level$/)),
      price: numRange(collect(section, /^price$/)) ?? uniqJoin(collect(section, /^price$/)),
      sourceUrl,
      contentHash,
    })
  })
  return out
}
