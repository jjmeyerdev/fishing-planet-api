import { createHash } from 'node:crypto'
import type { ParsedBobber } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { iconId, priceOf, trimTrailingEmpty } from './gear.js'

// Parse a bobber sub-type page (/Classic_Bobbers, /Wagglers, /Sliders,
// /Fishing_Alarm) into one record per item. No brand/technologies, no variant
// child — each purchasable item is its own row. Two column layouts: floats carry
// Color/Size/Shape/Max Floating Weight; the alarm carries Sensitivity instead.
// The source rowspans the Description column, so continuation rows drop it — we
// carry the last-seen description forward and reset it on a blank separator row.
// Buoys use an incompatible quantity-priced layout and are skipped.

const PICTURE = /<br\s*\/?>\s*\[!\[/i // a Picture cell: `Name<br>[![NNN.png](…)](…)`
const FLOAT_COLS = ['color', 'size', 'shape', 'maxFloatingWeight', 'material', 'unlockLevel', 'price'] as const
const ALARM_COLS = ['sensitivity', 'material', 'unlockLevel', 'price'] as const

export function parseBobbers(markdown: string, sourceUrl: string, subtype: string): ParsedBobber[] {
  if (subtype === 'buoys') return [] // quantity-priced layout — out of scope for this table
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const cols = subtype === 'fishing-alarm' ? ALARM_COLS : FLOAT_COLS
  const out: ParsedBobber[] = []

  let section: string | null = null
  let carriedDesc: string | null = null
  for (const raw of markdown.split('\n')) {
    const h = raw.match(/^##\s+(.+)/)
    if (h) {
      section = stripMd(h[1]) || null
      continue
    }
    if (!raw.trim().startsWith('|')) continue
    const cells = tableCells(raw)
    const pictureIdx = cells.findIndex((c) => PICTURE.test(c))
    if (pictureIdx < 0) {
      // standalone description row `| text |`, or a `|  |` group separator.
      const t = stripMd(cells[0] ?? '')
      carriedDesc = t.length > 20 ? t : null
      continue
    }

    const before = cells.slice(0, pictureIdx).map(stripMd).join(' ').trim()
    if (before) carriedDesc = before
    const spec = trimTrailingEmpty(cells.slice(pictureIdx + 1))

    const pic = cells[pictureIdx]
    const name = stripMd(pic.split(/<br\s*\/?>/i)[0])
    const imgMatch = pic.match(/!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/)
    const imageUrl = imgMatch ? imgMatch[1] : null
    const fpId = imageUrl ? iconId(imageUrl) : null

    const row: Record<string, string | null> = {}
    cols.forEach((key, i) => (row[key] = spec[i] != null ? stripMd(spec[i]) : null))
    const price = priceOf(spec[cols.length - 1] ?? '') // Price is the last column

    out.push({
      slug: slugify(`${subtype} ${name} ${fpId ?? ''}`),
      name,
      subtype,
      section,
      fpId,
      imageUrl,
      description: carriedDesc,
      color: row.color ?? null,
      size: row.size ?? null,
      shape: row.shape ?? null,
      maxFloatingWeight: row.maxFloatingWeight ?? null,
      sensitivity: row.sensitivity ?? null,
      material: row.material ?? null,
      unlockLevel: num(row.unlockLevel),
      ...price,
      sourceUrl,
      contentHash,
    })
  }
  return out
}
