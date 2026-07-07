import { createHash } from 'node:crypto'
import type { ParsedLine, ParsedLineVariant } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { brandAndName, foldRows, iconId, norm, pick, priceOf } from './gear.js'

// Parse a line sub-type page into one record per model. The most involved layout:
// each model is a 2-D grid — the diameter/test columns are one axis, and the model
// repeats per spool-size section (150/300/… yards), each carrying its own Line
// (icon), Price and Required level rows. So one variant = (diameter × spool). Pages
// split into `## **Regular**` (brand-linked) and `## **Exclusive**` (reward) models;
// /Saltwater_lines is a composite of six material sections.

const NAME = /^\|\s*(?:\[[^\]]+\]\([^)]*Brands[^)]*\)\s*)?\*\*[^*]+\*\*\s*\|\s*$/
const RULE = /^\s*\*\s*\*\s*\*\s*$/
const SPOOL = /^\|\s*\*\*[^|]*spool[^|]*\*\*\s*\|/i
const isModelRow = (l: string): boolean => NAME.test(l) && !/spool/i.test(l)

export function parseLines(markdown: string, sourceUrl: string, subtype: string): ParsedLine[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const out: ParsedLine[] = []

  for (const part of markdown.split(/^##\s+/m).slice(1)) {
    const nl = part.indexOf('\n')
    const title = stripMd(nl < 0 ? part : part.slice(0, nl))
    if (!title || /^contents$/i.test(title)) continue
    const material = materialOf(subtype, title)
    const kind = /exclusive/i.test(title) ? 'exclusive' : 'regular'

    const body = nl < 0 ? [] : part.slice(nl + 1).split('\n')
    const starts = body.map((l, i) => (isModelRow(l) ? i : -1)).filter((i) => i >= 0)
    starts.forEach((s, k) => {
      const block = body.slice(s, k + 1 < starts.length ? starts[k + 1] : body.length)
      out.push(parseModel(block, material, kind, sourceUrl, contentHash))
    })
  }
  return out
}

function parseModel(block: string[], subtype: string, kind: string, sourceUrl: string, contentHash: string): ParsedLine {
  const { brand, name } = brandAndName(block[0])
  let description: string | null = null
  for (const l of block.slice(1)) {
    const t = l.trim()
    if (t && !t.startsWith('|') && !t.startsWith('#') && !RULE.test(t)) {
      description = stripMd(t)
      break
    }
  }

  // A model may hold several diameter tables (split by `* * *`), each a full grid.
  const variants: ParsedLineVariant[] = []
  let seg: string[] = []
  const consume = () => {
    if (seg.length) variants.push(...parseSegment(seg))
    seg = []
  }
  for (const l of block.slice(1)) {
    if (RULE.test(l.trim())) consume()
    else seg.push(l)
  }
  consume()

  return {
    slug: slugify(`${subtype} ${kind} ${brand?.name ?? ''} ${name}`),
    name,
    subtype,
    kind,
    brand,
    description,
    color: variants.find((v) => v.color)?.color ?? null,
    variants,
    sourceUrl,
    contentHash,
  }
}

function parseSegment(seg: string[]): ParsedLineVariant[] {
  const spoolIdxs = seg.map((l, i) => (SPOOL.test(l) ? i : -1)).filter((i) => i >= 0)
  // Diameter/test/color axis lives before the first spool header (whole segment if none).
  const head = foldRows((spoolIdxs.length ? seg.slice(0, spoolIdxs[0]) : seg).map(tableCells))
  // Empty trailing `* * *` segment (no diameter axis, no spools) → nothing to emit.
  if (!head.has('Thickness') && !head.has('Test weight') && spoolIdxs.length === 0) return []
  const n = (head.get('Thickness::(mm)') ?? head.get('Test weight::(kg.)') ?? head.get('Thickness') ?? [null]).length
  const color = head.get('Color')?.[0] ? norm(head.get('Color')![0]) : null
  const axis = (j: number) => ({
    diameterMm: num(pick(head, 'Thickness::(mm)', j, n)),
    diameterIn: pick(head, 'Thickness', j, n),
    testLb: pick(head, 'Test weight', j, n),
    testKg: pick(head, 'Test weight::(kg.)', j, n),
    color,
  })

  // No spool sections (Exclusive lines): one variant per diameter, price from the head.
  if (spoolIdxs.length === 0) {
    return Array.from({ length: n }, (_, j): ParsedLineVariant => {
      const icon = lineIcon(pick(head, 'Line', j, n))
      return { ...axis(j), spool: null, ...priceOf(pick(head, 'Price', j, n) ?? ''), unlockLevel: num(pick(head, 'Required level', j, n)), ...icon }
    })
  }

  // Each spool section contributes N more variants (diameter × this spool).
  const variants: ParsedLineVariant[] = []
  spoolIdxs.forEach((s, si) => {
    const spool = stripMd(tableCells(seg[s])[0] ?? '').replace(/\s*spool\s*$/i, '').trim()
    const section = foldRows(seg.slice(s + 1, si + 1 < spoolIdxs.length ? spoolIdxs[si + 1] : seg.length).map(tableCells))
    for (let j = 0; j < n; j++) {
      const icon = lineIcon(pick(section, 'Line', j, n))
      variants.push({ ...axis(j), spool, ...priceOf(pick(section, 'Price', j, n) ?? ''), unlockLevel: num(pick(section, 'Required level', j, n)), ...icon })
    }
  })
  return variants
}

function lineIcon(cell: string | null): { imageUrl: string | null; fpId: number | null } {
  if (!cell) return { imageUrl: null, fpId: null }
  const m = cell.match(/!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/)
  const imageUrl = m && !/Credits|Baitcoins/i.test(m[1]) ? m[1] : null
  return { imageUrl, fpId: imageUrl ? iconId(imageUrl) : null }
}

// Page subtype → material; the composite saltwater page derives it from the heading.
function materialOf(subtype: string, title: string): string {
  if (subtype !== 'saltwater-lines') return subtype.replace(/-fishing-lines$/, '').replace(/-lines$/, '')
  const t = title.toLowerCase()
  if (/mono/.test(t)) return 'saltwater-mono'
  if (/braid/.test(t)) return 'saltwater-braid'
  if (/fluoro/.test(t)) return 'saltwater-fluoro'
  return 'saltwater'
}
