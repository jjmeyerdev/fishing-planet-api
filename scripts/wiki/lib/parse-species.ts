import { createHash } from 'node:crypto'
import type { ParsedSpecies } from './types.js'
import { num, sections, slugFromUrl, stripMd, tableCells, targetLinks, wikiLinks } from './markdown.js'

// Parse one wiki species page (e.g. /Zander/en) into a normalized record.
// The infobox is the pre-`##` region; the rest comes from ## sections.
export function parseSpecies(markdown: string, sourceUrl: string): ParsedSpecies {
  const slug = slugFromUrl(sourceUrl)
  const name = (markdown.match(/^#\s+(.+)$/m)?.[1] ?? slug).replace(/_/g, ' ').trim()
  const sec = sections(markdown)
  const infobox = markdown.split(/^##\s+/m)[0]

  // --- infobox: image, latin name, wikipedia, per-class weight caps + credit rates ---
  let imageUrl: string | null = null
  let latinName: string | null = null
  let wikipediaUrl: string | null = null
  const weight: Record<string, number | null> = {}
  const credits: Record<string, number | null> = {}

  for (const line of infobox.split('\n')) {
    const cells = tableCells(line)
    if (!imageUrl) {
      const img = line.match(/!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/)
      if (img && !/Credits|Baitcoins|icon/i.test(img[1])) imageUrl = img[1]
    }
    if (!wikipediaUrl) {
      const wp = line.match(/(https?:\/\/en\.wikipedia\.org\/wiki\/[^)\s\]]+)/)
      if (wp) wikipediaUrl = wp[1]
    }
    // single-cell latin-name row (Genus species), before the weight rows
    if (!latinName && cells.length === 1) {
      const t = cells[0]
      if (/^[A-Z][a-zäöü.]+ [A-Za-z][a-zäöü.]+/.test(t) && !/https?:|!\[|\[/.test(t)) latinName = t
    }
    if (cells.length >= 3 && /^(Common|Trophy|Unique)$/.test(cells[0])) {
      const cls = cells[0].toLowerCase()
      if (/up to/i.test(cells[1])) weight[cls] = num(cells[2])
      else if (/per kg/i.test(cells[1])) credits[cls] = num(cells[2])
    }
  }

  // --- description: prose, links/formatting stripped ---
  const description = sec.has('Description') ? stripMd(sec.get('Description')!) || null : null

  // --- preferred lures / baits: first named link per list item ---
  const lures = sec.has('Preferred lures') ? wikiLinks(sec.get('Preferred lures')!) : []
  const baits = sec.has('Preferred baits') ? wikiLinks(sec.get('Preferred baits')!) : []

  // --- locations: image-only flag links → their targets ---
  const locations = sec.has('Locations') ? targetLinks(sec.get('Locations')!) : []

  // --- family + hook size from the "Recommended…" section ---
  let family: string | null = null
  let hookSizeMin: string | null = null
  let hookSizeMax: string | null = null
  const tackle = sec.get('Recommended fishing methods and tackle') ?? ''
  const fam = tackle.match(/\[\*?\*?([^\]*]+?family)\*?\*?\]/i)
  if (fam) family = fam[1].trim()
  // Exotic families lack the "family" suffix (e.g. "Amazonian Others"); fall back to
  // the bold link in the tackle section. Only runs when the primary match misses, so
  // it can't change species whose family link already carries "family".
  if (!family) {
    const bold = tackle.match(/\[\*\*([^\]]+?)\*\*\]/)
    if (bold) family = bold[1].trim()
  }
  const hook = tackle.match(/(#[\dA-Za-z/]+)\s*[-–]\s*(#[\dA-Za-z/]+)/)
  if (hook) {
    hookSizeMin = hook[1]
    hookSizeMax = hook[2]
  }

  const contentHash = createHash('sha256').update(markdown).digest('hex')

  return {
    slug,
    name,
    latinName,
    family,
    description,
    imageUrl,
    wikipediaUrl,
    commonWeightMaxKg: weight.common ?? null,
    trophyWeightMaxKg: weight.trophy ?? null,
    uniqueWeightMaxKg: weight.unique ?? null,
    commonCreditsPerKg: credits.common ?? null,
    trophyCreditsPerKg: credits.trophy ?? null,
    uniqueCreditsPerKg: credits.unique ?? null,
    hookSizeMin,
    hookSizeMax,
    baits,
    lures,
    locations,
    sourceUrl,
    contentHash,
  }
}
