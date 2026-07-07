import type { WikiLink } from './types.js'
import { num, slugify, stripMd } from './markdown.js'

// Shared parsing primitives for the tackle "gear" categories. The reels parser
// (parse-reels.ts) predates these and keeps its own copies; the newer parsers
// (rods/lines/hooks/sinkers/bobbers/lures) share this module.

// Collapse markdown emphasis + whitespace to a comparable label/value.
export const norm = (s: string): string => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()

// A model header row: `| [Brand™](…/Brands "Brands") **Model** |`. Also matches
// an unbranded `| **Model** |` (lines/sinkers Exclusive items) → brand null.
export const BRAND_LINK = /\[[^\]]+\]\([^)]*Brands[^)]*\)/

export function brandAndName(cell: string): { brand: WikiLink | null; name: string } {
  const m = cell.match(/\[([^\]]+)\]\([^)]*Brands[^)]*\)\s*\*\*([^*]+)\*\*/)
  if (m) {
    const brandName = stripMd(m[1])
    return { brand: brandName ? { name: brandName, slug: slugify(brandName) } : null, name: m[2].trim() }
  }
  const bold = cell.match(/\*\*([^*]+)\*\*/)
  return { brand: null, name: (bold ? bold[1] : stripMd(cell)).trim() }
}

export interface Price {
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null
}

// Price cell → currency by icon (Baitcoins/Credits), else free reward/DLC text.
export function priceOf(cell: string): Price {
  if (/Baitcoins/i.test(cell)) return { priceCredits: null, priceBaitcoins: num(cell), priceNote: null }
  if (/Credits/i.test(cell)) return { priceCredits: num(cell), priceBaitcoins: null, priceNote: null }
  const note = stripMd(cell)
  return { priceCredits: null, priceBaitcoins: null, priceNote: note && note !== '-' ? note : null }
}

// The numeric id embedded in an image filename (…/723.png or …/200px-723.png → 723).
export function iconId(url: string): number | null {
  const file = (url.split('/').pop() ?? '').replace(/^\d+px-/, '')
  const m = file.match(/^(\d+)\.png/i)
  return m ? Number(m[1]) : null
}

// First /images/ picture across `lines` that isn't a currency icon (model photo).
export function firstImage(lines: string[]): string | null {
  for (const l of lines) {
    const im = l.match(/!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/)
    if (im && !/Credits|Baitcoins/i.test(im[1])) return im[1]
  }
  return null
}

// Tech slug/name from an icon URL: numeric filename → tech-<id> (parity with the
// reels-derived technologies); named file (U_ProtoFibre.png) → tech-<slug(base)>.
function techFromUrl(url: string, alt: string): WikiLink | null {
  const base = (url.split('/').pop() ?? '').replace(/^\d+px-/, '').replace(/\.png.*$/i, '')
  if (!base || /^(Credits|Baitcoins)$/i.test(base)) return null
  const numId = base.match(/^(\d+)$/)
  if (numId) return { name: stripMd(alt).slice(0, 60) || base, slug: `tech-${numId[1]}` }
  const clean = base.replace(/[®™]/g, '')
  return { name: clean, slug: `tech-${slugify(clean)}` }
}

// Technology icons between a "Technologies included" marker and the first spec-table
// row. `stopAt` matches that first row's label (rods start at | Length / | Name).
export function techsFromIcons(lines: string[], stopAt: RegExp): WikiLink[] {
  const techs = new Map<string, WikiLink>()
  const start = lines.findIndex((l) => /Technologies included/i.test(l))
  if (start < 0) return []
  for (const l of lines.slice(start + 1)) {
    if (stopAt.test(l)) break
    // Tech icons are BARE `![alt](url)`; model/edition photos are wrapped in a
    // File link (`[![alt](url)](…/File:…)`) — drop those so a stacked edition
    // photo between two tech rows isn't mistaken for a technology.
    const bare = l.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    const re = /!\[([^\]]*)\]\((https?:\/\/[^)]*\/images\/[^)\s]+)\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(bare))) {
      const t = techFromUrl(m[2], m[1])
      if (t && !techs.has(t.slug)) techs.set(t.slug, t)
    }
  }
  return [...techs.values()]
}

// Trailing cells that are empty once emphasis is stripped (markdown pads rows).
export function trimTrailingEmpty(cells: string[]): string[] {
  let end = cells.length
  while (end > 0 && norm(cells[end - 1]) === '') end--
  return cells.slice(0, end)
}

// A unit-only cell: (ft.) / (m) / (oz.) / ( cm) (tolerating stray inner spaces).
export const UNIT = /^\**\(\s*[^)]*\)\**$/
export const unitKey = (s: string): string => norm(s).replace(/\s+/g, '') // "( cm)" → "(cm)"

// Fold labeled table rows into `label → value cells`, attaching a unit-continuation
// row (`| (m) | … |`) under `label::(unit)`. First occurrence of a label wins.
export function foldRows(rows: string[][]): Map<string, string[]> {
  const F = new Map<string, string[]>()
  let last: string | null = null
  for (const raw of rows) {
    const c = trimTrailingEmpty(raw)
    if (c.length < 2) continue
    const first = norm(c[0])
    if (UNIT.test(first)) {
      if (last) F.set(`${last}::${unitKey(first)}`, c.slice(1))
      continue
    }
    const hasUnit = UNIT.test(norm(c[1]))
    const values = c.slice(hasUnit ? 2 : 1)
    if (!F.has(first)) F.set(first, values)
    if (hasUnit && !F.has(`${first}::${unitKey(norm(c[1]))}`)) F.set(`${first}::${unitKey(norm(c[1]))}`, values)
    last = first
  }
  return F
}

// Broadcast-aware value pick: a single shared value applies to every variant; N
// values map 1:1; anything else falls back to the j-th (then last) cell.
export function pick(F: Map<string, string[]>, key: string, j: number, n: number): string | null {
  const arr = F.get(key)
  if (!arr || arr.length === 0) return null
  if (arr.length === n) return norm(arr[j]) || null
  if (arr.length === 1) return norm(arr[0]) || null
  return norm(arr[j] ?? arr[arr.length - 1]) || null
}
