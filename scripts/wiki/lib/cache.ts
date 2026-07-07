import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// On-disk cache of raw scrapes. `pages/` holds one JSON per URL (the crawl
// checkpoint = free resume); parsed.json / manifest.json live at the top level.
export const CACHE_DIR = '.cache/wiki'
export const PAGES_DIR = join(CACHE_DIR, 'pages')

export interface CacheEntry {
  url: string
  // 'index' = discovery pages (species families) scraped only for their links.
  category: 'species' | 'reels' | 'rods' | 'lines' | 'hooks' | 'sinkers' | 'bobbers' | 'lures' | 'baits' | 'groundbaits' | 'brands' | 'technologies' | 'index'
  subtype?: string // sub-type page slug, e.g. reels: spinning | casting | saltwater
  fetchedAt: string
  status: number
  markdown: string
}

const key = (url: string) => createHash('sha256').update(url).digest('hex').slice(0, 32)
const pagePath = (url: string) => join(PAGES_DIR, `${key(url)}.json`)

export function readCache(url: string): CacheEntry | null {
  const p = pagePath(url)
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as CacheEntry) : null
}

export function writeCache(entry: CacheEntry): void {
  mkdirSync(PAGES_DIR, { recursive: true })
  writeFileSync(pagePath(entry.url), JSON.stringify(entry))
}

export function allPages(): CacheEntry[] {
  if (!existsSync(PAGES_DIR)) return []
  return readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(PAGES_DIR, f), 'utf8')) as CacheEntry)
}
