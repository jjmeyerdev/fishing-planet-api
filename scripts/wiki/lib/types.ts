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

// --- Gear categories (rods / lines / hooks / sinkers / bobbers / lures) ---
// Values that are ranges or fractions ("1/32 - 1/4", "3 + 3", "6'6\" NE") are kept
// as strings — num() would silently drop everything after the first token.

export interface ParsedRodVariant {
  name: string | null // length string ("6'6\" NE") or DLC edition name
  lengthFt: string | null
  lengthM: string | null
  lureWeightOz: string | null // also covers "Casting Weight"
  lureWeightG: string | null
  lineWeightLb: string | null // when per-variant (else on the model)
  lineWeightKg: string | null
  pieces: string | null // "2" or "3 + 3"
  guides: string | null // "8" or "11 + 6"
  unlockLevel: number | null
  priceCredits: number | null
  priceBaitcoins: number | null
  dlcPack: string | null // when Price is "DLC [pack]" rather than a number
}

export interface ParsedRod {
  slug: string
  name: string
  subtype: string // spinning-rods | casting-rods | …
  brand: WikiLink | null
  description: string | null
  imageUrl: string | null
  power: string | null // shared spec, hoisted to the model
  action: string | null
  lineWeightLb: string | null // shared line weight (else per-variant)
  lineWeightKg: string | null
  electric: boolean | null // saltwater rods only
  quiverTips: string | null // feeder rods: "3/84g, 4/112g, 5/140g" (appended sub-table)
  technologies: WikiLink[] // resolved to WikiTechnology at load, like reels
  variants: ParsedRodVariant[]
  sourceUrl: string
  contentHash: string
}

export interface ParsedLineVariant {
  diameterMm: number | null
  diameterIn: string | null
  testLb: string | null
  testKg: string | null
  color: string | null
  spool: string | null // "150 yards BASIC"
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null // reward text on exclusive lines
  unlockLevel: number | null
  imageUrl: string | null
  fpId: number | null // NNN.png icon id
}

export interface ParsedLine {
  slug: string
  name: string
  subtype: string // monofilament | fluorocarbon | braided | saltwater-mono | …
  kind: string // regular | exclusive
  brand: WikiLink | null
  description: string | null
  color: string | null
  variants: ParsedLineVariant[]
  sourceUrl: string
  contentHash: string
}

export interface ParsedHookVariant {
  size: string | null // "#1/0" (kept verbatim with leading '#')
  weightOz: string | null // jig heads only ("5/8")
  weightG: number | null // jig heads only
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null
  unlockLevel: number | null
  imageUrl: string | null
}

export interface ParsedHook {
  slug: string
  name: string
  kind: string // hook | jighead
  subtype: string
  brand: WikiLink | null // plain hooks only
  type: string | null // plain hooks: Kirby/Octopus/…
  color: string | null
  sharpening: string | null
  count: number | null // pack count
  description: string | null
  imageUrl: string | null
  variants: ParsedHookVariant[]
  sourceUrl: string
  contentHash: string
}

export interface ParsedSinkerVariant {
  weightG: number | null
  weightOz: string | null // fraction text ("1 3/4")
  capacityKg: number | null // catapults
  capacityLb: string | null
  form: string | null // sinkers (Flat Pear / Bullet / …)
  count: number | null
  capacity: string | null // feeders (Low/Medium/High)
  feederType: string | null // Mesh Cage / PVA Bag / …
  dissolutionTime: string | null // pva feeders
  variantName: string | null // pva feeders (Name row)
  mesh: string | null
  range: string | null // catapults
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null
  unlockLevel: number | null
  imageUrl: string | null
}

export interface ParsedSinker {
  slug: string
  name: string
  kind: string // sinker | feeder
  subtype: string
  brand: WikiLink | null
  description: string | null
  imageUrl: string | null
  variants: ParsedSinkerVariant[]
  sourceUrl: string
  contentHash: string
}

// Bobbers are one row per item (no variant child); buoys are skipped.
export interface ParsedBobber {
  slug: string
  name: string
  subtype: string // classic-bobbers | wagglers | sliders | fishing-alarm
  section: string | null // Regular | Exclusive
  fpId: number | null // NNN.png image id (identity — names collide)
  imageUrl: string | null
  description: string | null
  color: string | null // float only
  size: string | null // float only (raw compound string)
  shape: string | null // float only
  maxFloatingWeight: string | null // float only
  sensitivity: string | null // alarm only
  material: string | null
  unlockLevel: number | null
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null
  sourceUrl: string
  contentHash: string
}

export interface ParsedLureVariant {
  color: string | null
  imageUrl: string | null
  buoyancy: string | null // plugs / some saltwater
  weightG: number | null
  lengthCm: number | null
  divingDepthM: number | null // plugs only
  hookSize: string | null // "#2/0" or range "#2 - #2/0" (Fitting Hook)
  quantity: number | null // saltwater teasers
  unlockLevel: number | null
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null
}

export interface ParsedLure {
  slug: string
  name: string
  subtype: string // spoons | plugs | soft-plastic-baits | spinners | bass-jigs | saltwater-lures
  description: string | null
  variants: ParsedLureVariant[]
  sourceUrl: string
  contentHash: string
}

// Flat consumable bait (Common/Worms/Fresh/Saltwater + the flat rows of Event).
export interface ParsedBait {
  slug: string
  name: string
  subtype: string // common-baits | worms-insects-baits | fresh-baits | saltwater-baits | event-baits
  fpId: number | null // NNN.png image id (named files like Bread.png → null)
  imageUrl: string | null
  description: string | null
  targetFish: string[] // raw species names (the comma-separated cell); FK-resolve later
  quantity: number | null // pack size
  weightClass: string | null // Light | Med-Light | Medium | Med-Heavy | Heavy | X Heavy
  unlockLevel: number | null
  hookSize: string | null // "#10 - #6", often null
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null // reward/DLC text when Price isn't a plain currency amount
  sourceUrl: string
  contentHash: string
}

// One boilie (flattened from a block-per-model column on Boilies&Pellets / Event).
export interface ParsedBoilie {
  slug: string
  name: string
  subtype: string // boilies-pellets-baits | event-baits
  fpId: number | null
  imageUrl: string | null // the "Boilies" image
  boilImageUrl: string | null // the "Boil" hookbait image
  description: string | null // event boilies only
  sizeIn: string | null
  sizeMm: string | null
  targetFish: string[]
  flavour: string | null
  color: string | null
  buoyancy: string | null // Sinking | Pop-Up
  weightClass: string | null
  quantity: number | null
  unlockLevel: number | null
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null
  sourceUrl: string
  contentHash: string
}

// Groundbaits — feed/attractant consumables. One flat shape covers both the flat
// catalog pages (aromas, particles) and the flattened block-per-model mix pages
// (carp/base/method-mix); subtype-specific columns are null off-subtype (same
// shape as ParsedBobber's float-vs-alarm columns).
export interface ParsedGroundbait {
  slug: string
  name: string
  subtype: string // aromas | particles | carp-groundbaits | groundbait-base | method-mix-groundbaits
  fpId: number | null
  imageUrl: string | null
  brand: string | null // flat pages only (raw brand name; FK-resolve later)
  description: string | null // flat pages only
  targetFish: string[]
  temperature: string | null // flat "Weather Conditions" / block "Temperature" (Warm/Cold)
  aroma: string | null // aromas + base
  effect: string | null // aromas only
  contains: string | null // particles only
  flavour: string | null // carp/method only
  color: string | null // carp/method only
  grain: string | null // base only
  density: string | null // base only
  ponds: string | null // block pages
  nutritionValue: string | null // block pages
  sizeMm: string | null // carp only
  weight: string | null // raw ("2.2 / 1.0" lb/kg flat, or the kg value on mixes)
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null
  unlockLevel: number | null
  sourceUrl: string
  contentHash: string
}

// Equipment — apparel + storage + stringers/keepnets. One table over all 7 pages;
// columns vary a lot per subtype (glasses: color/material; hats: tackles/flashlight;
// cases/boxes/waistcoats: storageCapacity; rod-holders: rodSlot/standCount/biteAlarm;
// stringers-keepnets: fish-weight limits/durability). Null off-subtype (wiki_bobbers
// pattern). Flat pages are one-row-per-item; the stringers-keepnets page is header +
// Name-block (flattened per variant).
export interface ParsedEquipment {
  slug: string
  name: string
  subtype: string // glasses-and-flashlights | hats | rod-cases | tackle-boxes | waist-coats | rod-holders | stringers-keepnets
  fpId: number | null
  imageUrl: string | null
  brand: string | null // explicit Brand column / block header (raw name)
  description: string | null
  material: string | null
  color: string | null // glasses
  tackles: string | null // hats — tackle-slot capacity
  flashlight: string | null // hats
  flashlightSlot: string | null // hats
  storageCapacity: string | null // cases/boxes/waistcoats ("Rods: 2; Reels: 2; Lines: 2")
  rodSlot: string | null // rod-holders
  standCount: string | null // rod-holders
  biteAlarm: string | null // rod-holders
  weight: string | null // rod-holders (raw "lb / kg")
  maxSingleFishWeightKg: string | null // stringers-keepnets (min–max range across the line's sizes)
  maxTotalFishWeightKg: string | null // stringers-keepnets
  fishFriendly: string | null // stringers-keepnets
  durability: string | null // stringers-keepnets
  priceCredits: number | null
  priceBaitcoins: number | null
  priceNote: string | null
  unlockLevel: number | null
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
  rods: ParsedRod[]
  lines: ParsedLine[]
  hooks: ParsedHook[]
  sinkers: ParsedSinker[]
  bobbers: ParsedBobber[]
  lures: ParsedLure[]
  baits: ParsedBait[]
  boilies: ParsedBoilie[]
  groundbaits: ParsedGroundbait[]
  equipment: ParsedEquipment[]
  brands: ParsedBrand[]
  technologies: ParsedTechnology[]
}
