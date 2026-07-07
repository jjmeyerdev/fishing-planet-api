import { createHash } from 'node:crypto'
import type { ParsedOther } from './types.js'
import { slugify, stripMd, tableCells } from './markdown.js'
import { iconId, priceOf } from './gear.js'

// Parse the grab-bag /Other pages (/Fireworks, /Mission_Items, /Repair_kits) into
// one record per item. Layouts differ slightly — fireworks has a Name | Firework |
// Description | Price header; mission-items is header-less with a **bold** name,
// image, and description — so key off the image cell and read positionally: name
// is the first cell, description the cell after the image, price any currency cell.

const IMAGE = /!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/

export function parseOther(markdown: string, sourceUrl: string, subtype: string): ParsedOther[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const out: ParsedOther[] = []
  for (const raw of markdown.split('\n')) {
    if (!raw.trim().startsWith('|')) continue
    const c = tableCells(raw)
    const imgIdx = c.findIndex((x) => IMAGE.test(x))
    if (imgIdx < 1) continue // header ("Name"), separator ("---"), and image-less rows
    const name = stripMd(c[0])
    if (!name || /^name$/i.test(name)) continue
    const imageUrl = c[imgIdx].match(IMAGE)![1]
    const priceCell = c.find((x) => /Credits|Baitcoins/i.test(x)) ?? ''
    out.push({
      slug: slugify(`${subtype} ${name} ${iconId(imageUrl) ?? ''}`),
      name,
      subtype,
      fpId: iconId(imageUrl),
      imageUrl,
      description: stripMd(c[imgIdx + 1] ?? '') || null,
      ...priceOf(priceCell),
      sourceUrl,
      contentHash,
    })
  }
  return out
}
