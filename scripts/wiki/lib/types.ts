// Normalized shapes the `parse` stage emits and the `load` stage consumes.
// Kept deliberately flat/JSON-friendly so parsed output can be cached to disk and
// re-loaded without touching the network or the DB.

export interface WikiLink {
  name: string
  slug: string // canonical wiki page slug (target of the link)
}

export interface ParsedSpecies {
  slug: string
  name: string
  latinName: string | null
  family: string | null
  description: string | null
  imageUrl: string | null
  wikipediaUrl: string | null
  commonWeightMaxKg: number | null
  trophyWeightMaxKg: number | null
  uniqueWeightMaxKg: number | null
  commonCreditsPerKg: number | null
  trophyCreditsPerKg: number | null
  uniqueCreditsPerKg: number | null
  hookSizeMin: string | null
  hookSizeMax: string | null
  // unresolved cross-category links (target tables arrive in later phases)
  baits: WikiLink[]
  lures: WikiLink[]
  locations: WikiLink[]
  sourceUrl: string
  contentHash: string
}

export interface ParsedReelVariant {
  spoolSize: string | null
  gearRatio: string | null
  retrieveCm: number | null
  maxDragKg: number | null
  ballBearings: string | null
  weightG: number | null
  lineCapacity: string | null
  priceCredits: number | null
  priceBaitcoins: number | null
  unlockLevel: number | null
}

export type ReelSubtype = 'spinning' | 'casting' | 'saltwater'

export interface ParsedReel {
  slug: string
  name: string
  subtype: ReelSubtype
  brand: WikiLink | null
  description: string | null
  imageUrl: string | null
  technologies: WikiLink[] // resolved to WikiTechnology at load
  variants: ParsedReelVariant[]
  sourceUrl: string
  contentHash: string
}

export interface ParsedBrand {
  slug: string
  name: string
  description: string | null
  imageUrl: string | null
  sourceUrl: string | null
  contentHash: string | null
}

export interface ParsedTechnology {
  slug: string
  name: string
  description: string | null
  category: string | null
}

// The full parsed dataset written by `parse` and read by `load`.
export interface ParsedDataset {
  species: ParsedSpecies[]
  reels: ParsedReel[]
  brands: ParsedBrand[]
  technologies: ParsedTechnology[]
}
