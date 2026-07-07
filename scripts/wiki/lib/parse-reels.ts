import { createHash } from 'node:crypto'
import type { ParsedReel, ParsedReelVariant, ReelSubtype, WikiLink } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'

const norm = (s: string): string => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()

// Each reel model is a block starting at a header row:
//   | [Brand™](…/Brands "Brands") **Model Name** |
const HEADER = /^\|\s*\[[^\]]+\]\([^)]*Brands[^)]*\)\s*\*\*[^*]+\*\*\s*\|/

// Parse a reel sub-type page (/Spinning_reels, …) into one record per model.
export function parseReels(markdown: string, sourceUrl: string, subtype: ReelSubtype): ParsedReel[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const heads = lines.map((l, i) => (HEADER.test(l) ? i : -1)).filter((i) => i >= 0)

  return heads.map((start, k) => {
    const block = lines.slice(start, k + 1 < heads.length ? heads[k + 1] : lines.length)
    return parseBlock(block, sourceUrl, subtype, contentHash)
  })
}

function parseBlock(lines: string[], sourceUrl: string, subtype: ReelSubtype, contentHash: string): ParsedReel {
  const header = lines[0]
  const name = header.match(/\*\*([^*]+)\*\*/)?.[1].trim() ?? ''
  // The link points at the shared /Brands page, so the brand *name* is the
  // identity — derive the slug from it (MagFin™ → magfin), not the link target.
  const brandM = header.match(/\[([^\]]+)\]\([^)]*Brands[^)]*\)/)
  const brandName = brandM ? stripMd(brandM[1]) : ''
  const brand: WikiLink | null = brandName ? { name: brandName, slug: slugify(brandName) } : null

  // model photo: first /images/ picture that isn't a currency icon
  let imageUrl: string | null = null
  for (const l of lines) {
    const im = l.match(/!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/)
    if (im && !/Credits|Baitcoins/i.test(im[1])) {
      imageUrl = im[1]
      break
    }
  }

  // description: first long prose single-cell row after the header
  let description: string | null = null
  for (const l of lines.slice(1)) {
    const c = tableCells(l)
    if (c.length === 1) {
      const t = stripMd(c[0])
      if (t.length > 40 && !/Technologies included/i.test(t)) {
        description = t
        break
      }
    }
  }

  // technologies: icon images between "Technologies included" and the spec table.
  // The numeric icon filename (…/649.png) is the stable id → slug `tech-649`.
  const techs = new Map<string, WikiLink>()
  const techStart = lines.findIndex((l) => /Technologies included/i.test(l))
  if (techStart >= 0) {
    for (const l of lines.slice(techStart + 1)) {
      if (/^\|\s*Model\s*\|/i.test(l) || /Gear Ratio/i.test(l)) break
      const re = /!\[([^\]]*)\]\((?:https?:\/\/[^)]*\/)(\d+)\.png[^)]*\)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(l))) {
        const slug = `tech-${m[2]}`
        if (!techs.has(slug)) techs.set(slug, { name: stripMd(m[1]).slice(0, 60), slug })
      }
    }
  }

  return {
    slug: slugify(`${subtype} ${brand?.name ?? ''} ${name}`),
    name,
    subtype,
    brand,
    description,
    imageUrl,
    technologies: [...techs.values()],
    variants: parseVariants(lines),
    sourceUrl,
    contentHash,
  }
}

// The spec table has one value column per spool size. Values are always the last
// N cells of a row (N from the `Model` row) — true whether the row is
// `| Label | (unit) | v1 | v2 |` or a unit continuation `| (cm) | v1 | v2 |`.
function parseVariants(lines: string[]): ParsedReelVariant[] {
  const rows = lines.map(tableCells).filter((c) => c.length >= 2)
  const modelRow = rows.find((c) => /^Model$/i.test(norm(c[0])))
  if (!modelRow) return []
  const spools = modelRow.slice(1).map(norm).filter(Boolean)
  const n = spools.length
  if (n === 0) return []

  // Value cells for a spec row, aligned to the n spool columns. A single value
  // broadcasts to every spool (identical DLC "Edition" reels list one shared
  // value per row); a full row maps 1:1; a longer row (stray leading unit cell)
  // keeps its last n. Broadcasting first avoids reading the label cell as a value.
  const cells = (pred: RegExp): string[] | null => {
    const row = rows.find((c) => pred.test(norm(c[0])))
    if (!row) return null
    const values = row.slice(1)
    if (values.length === 1) return Array(n).fill(values[0])
    return values.length > n ? values.slice(-n) : values
  }
  const gear = cells(/^Gear Ratio$/i)
  const retrieve = cells(/^\(cm\)$/i)
  const drag = cells(/^\(kg\)$/i)
  const weight = cells(/^\(g\)$/i)
  const bearings = cells(/^Ball Bearings$/i)
  const lineCap = cells(/^\(mm\/m\)$/i)
  const level = cells(/^Required level$/i)
  const price = cells(/^Price$/i)

  return spools.map((spool, j): ParsedReelVariant => {
    // Currency by icon, like gear.ts priceOf: a bare number only counts as a
    // price when the cell carries the Credits/Baitcoins icon. DLC-pack and reward
    // notes (no icon) are dropped so stray digits in their text/URLs
    // (e.g. St.Patrick%27s → 27) don't become a bogus Credits price.
    const priceCell = price?.[j] ?? ''
    const baitcoins = /Baitcoins/i.test(priceCell)
    const credits = /Credits/i.test(priceCell)
    return {
      spoolSize: spool || null,
      gearRatio: gear?.[j] ? norm(gear[j]) : null,
      retrieveCm: num(retrieve?.[j]),
      maxDragKg: num(drag?.[j]),
      ballBearings: bearings?.[j] ? norm(bearings[j]) : null,
      weightG: num(weight?.[j]),
      lineCapacity: lineCap?.[j] ? stripMd(lineCap[j]) : null,
      priceCredits: credits ? num(priceCell) : null,
      priceBaitcoins: baitcoins ? num(priceCell) : null,
      unlockLevel: num(level?.[j]),
    }
  })
}
