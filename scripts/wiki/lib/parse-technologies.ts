import type { ParsedTechnology } from './types.js'
import { stripMd, tableCells } from './markdown.js'

// Parse a dedicated technologies page (/Reels_technologies, /Rods_technologies) to
// enrich the technology rows derived (name-only) from gear icons. Each tech is a
// `| ![NNN.png] | description |` row followed by a `| Name® |` row — the numeric
// icon id gives the same `tech-<id>` slug the gear icons produced, so descriptions
// match by id. Techs whose gear icon was a named file (tech-<slug>) have no
// numeric entry here and stay name-only.

export function parseTechnologies(markdown: string, category: string): ParsedTechnology[] {
  const lines = markdown.split('\n')
  const out: ParsedTechnology[] = []
  for (let i = 0; i < lines.length; i++) {
    const c = tableCells(lines[i])
    if (c.length < 2) continue
    const idm = c[0].match(/\/images\/[^)]*?\/(\d+)\.png/)
    if (!idm) continue
    const description = stripMd(c[1])
    if (description.length < 20) continue
    // Name sits in the next single-cell row.
    let name = ''
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const cc = tableCells(lines[j])
      if (cc.length === 1 && cc[0].trim()) {
        name = stripMd(cc[0])
        break
      }
    }
    out.push({ slug: `tech-${idm[1]}`, name, description, category })
  }
  return out
}
