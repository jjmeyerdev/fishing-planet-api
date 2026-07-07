import { createHash } from 'node:crypto'
import type { ParsedBait } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { iconId, priceOf } from './gear.js'

// Parse a flat baits sub-type page (/Common_Baits, /Worms_&_Insects_Baits,
// /Fresh_Baits, /Saltwater_Baits, and the flat rows of /Event_Baits) into one
// record per item. Fixed 8-column layout — the header is identical on every flat
// page: Bait | Description | Target Fish | Price | Quantity | Weight | Required
// level | Recommended hook size. The item name is the **bold** prefix of the
// Description cell (there is no separate name column). Prices carry the Credits/
// Baitcoins icon (priceOf); reward/DLC cells become a priceNote. The boilie blocks
// that share /Event_Baits have a label (not an image) in column 0, so they never
// match here — parseBoilies handles those.

const IMAGE = /!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/

export function parseBaits(markdown: string, sourceUrl: string, subtype: string): ParsedBait[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const out: ParsedBait[] = []
  for (const raw of markdown.split('\n')) {
    if (!raw.trim().startsWith('|')) continue
    const c = tableCells(raw)
    if (c.length !== 8) continue
    const img = c[0].match(IMAGE)
    if (!img) continue // the header ("Bait"), separator ("---"), and boilie label rows carry no image in col 0
    const imageUrl = img[1]
    const bold = c[1].match(/\*\*([^*]+)\*\*/)
    const alt = c[0].match(/!\[([^\]]*)\]/)?.[1] ?? ''
    const name = (bold ? bold[1] : alt.replace(/\.png$/i, '').replace(/_/g, ' ')).trim()
    if (!name) continue
    const fpId = iconId(imageUrl)
    out.push({
      slug: slugify(`${subtype} ${name} ${fpId ?? ''}`),
      name,
      subtype,
      fpId,
      imageUrl,
      description: stripMd(c[1]) || null,
      targetFish: c[2].split(',').map((s) => stripMd(s)).filter(Boolean),
      quantity: num(c[4]),
      weightClass: stripMd(c[5]) || null,
      unlockLevel: num(c[6]),
      hookSize: stripMd(c[7]) || null,
      ...priceOf(c[3]),
      sourceUrl,
      contentHash,
    })
  }
  return out
}
