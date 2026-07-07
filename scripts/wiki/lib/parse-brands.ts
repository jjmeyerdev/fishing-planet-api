import { createHash } from 'node:crypto'
import type { ParsedBrand } from './types.js'
import { slugify, stripMd } from './markdown.js'

// Parse the dedicated /Brands page to enrich the brand rows that are otherwise
// derived (name-only) from gear. Each brand is a logo image (`[![Name™.png](…)]`)
// followed by its description paragraphs, up to the next logo. The brand name is
// the image alt (→ same slug as the gear-derived brand); the image is the logo.

const LOGO = /^\[?!\[([^\]]+™[^\]]*|[^\]]+)\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/

export function parseBrands(markdown: string, sourceUrl: string): ParsedBrand[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const logos = lines
    .map((l, i) => {
      const m = l.match(LOGO)
      return m ? { i, name: stripMd(m[1]).replace(/\.png$/i, '').trim(), imageUrl: m[2] } : null
    })
    .filter((x): x is { i: number; name: string; imageUrl: string } => x !== null)

  const out: ParsedBrand[] = []
  logos.forEach((lg, k) => {
    const end = k + 1 < logos.length ? logos[k + 1].i : lines.length
    const description = lines.slice(lg.i + 1, end).map(stripMd).filter((t) => t.length > 30).join(' ') || null
    // Real brand entries carry a description; skip stray logos/nav images that don't.
    if (!lg.name || !description) return
    out.push({ slug: slugify(lg.name), name: lg.name, description, imageUrl: lg.imageUrl, sourceUrl, contentHash })
  })
  return out
}
