import type { WikiLink } from './types.js'

// Canonical wiki slug from a URL, stripping language suffix:
//   https://wiki.fishingplanet.com/Zander/en → "Zander"
export function slugFromUrl(url: string): string {
  const m = url.match(/wiki\.fishingplanet\.com\/([^?#]+)/)
  if (!m) return url
  return decodeURIComponent(m[1]).replace(/\/(en|ru|uk|de|fr|es|pl)$/i, '')
}

export const readable = (slug: string): string => slug.replace(/_/g, ' ').trim()

// A url-safe slug for entities with no wiki page of their own (e.g. reel models).
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// First number in a string (handles "2 (4.4)", "2,500", "5.4:1" → 5.4).
export function num(s: string | null | undefined): number | null {
  if (s == null) return null
  const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}

// Split a markdown table row "| a | b | c |" into trimmed cells.
export function tableCells(line: string): string[] {
  const t = line.trim()
  if (!t.startsWith('|')) return []
  const inner = t.replace(/^\|/, '').replace(/\|$/, '')
  return inner.split('|').map((c) => c.trim())
}

// Strip markdown emphasis, images, and links (keeping link text) → plain text.
export function stripMd(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Split markdown into a map of `## Section` title → body (trailing colon dropped).
export function sections(markdown: string): Map<string, string> {
  const map = new Map<string, string>()
  const parts = markdown.split(/^##\s+/m)
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n')
    const title = (nl < 0 ? part : part.slice(0, nl)).trim().replace(/:$/, '')
    map.set(title, nl < 0 ? '' : part.slice(nl + 1))
  }
  return map
}

// Non-content link targets: image files, media namespaces — never real entities.
const isImageOrFile = (slug: string): boolean =>
  /^images\//i.test(slug) ||
  /\.(png|jpe?g|gif|svg|webp)$/i.test(slug) ||
  /^(File|Special|MediaWiki|Category|Template):/i.test(slug)

// Named internal wiki links `[Text](https://wiki…/Slug "title")`, deduped by NAME
// (two names can point at one page — e.g. Narrow vs Medium Spoons → /Spoons).
export function wikiLinks(md: string): WikiLink[] {
  const out = new Map<string, WikiLink>()
  const re = /\[([^\]]+)\]\((https?:\/\/wiki\.fishingplanet\.com\/[^)\s"]+)(?:\s+"[^"]*")?\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md))) {
    const name = stripMd(m[1])
    const slug = slugFromUrl(m[2])
    if (!name || name.startsWith('http') || m[1].trimStart().startsWith('!') || isImageOrFile(slug)) continue
    if (!out.has(name)) out.set(name, { name, slug })
  }
  return [...out.values()]
}

// Link *targets* (for image-only links like the Locations flags), deduped by slug.
export function targetLinks(md: string): WikiLink[] {
  const out = new Map<string, WikiLink>()
  const re = /\]\((https?:\/\/wiki\.fishingplanet\.com\/[^)\s"]+)(?:\s+"([^"]*)")?\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md))) {
    const slug = slugFromUrl(m[1])
    if (isImageOrFile(slug)) continue
    if (!out.has(slug)) out.set(slug, { name: readable(slug), slug })
  }
  return [...out.values()]
}
