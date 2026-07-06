# PRD — Import the full FP-Collective structured dataset

## Summary

We have the complete FP-Collective dataset as structured JSON (13 files, currently
on `~/Desktop/data`). It is the same source the current `data/**/*.md` was scraped
from, but far richer and fully relational — every record carries a stable
FP-Collective ID and the files cross-reference each other by those IDs.

This PRD covers importing **all** of it: enriching the existing `Fish` /
`Location` / `FishLocation` data, and adding three new domains — the tackle/gear
catalog, geo **spots**, and per-place **weather**.

## Source files

| File | Records | Maps to |
|------|--------:|---------|
| `fish.json` | 273 | `Fish` (enrich) + fish→bait / fish→lure-type relations |
| `places.json` | 27 | `Location` (enrich) + `FishLocation` (rebuild) |
| `spots.json` | 113 | **new** `Spot` |
| `weathers.json` | 167 | **new** `Weather` |
| `baits.json` | 125 | **new** `Bait` |
| `boilies-pellets.json` | 144 | **new** `Boilie` |
| `lures.json` | 1291 | **new** `Lure` |
| `lure-types.json` | 59 | **new** `LureType` |
| `hooks.json` | 143 | **new** `Hook` |
| `jigheads.json` | 266 | **new** `Jighead` |
| `sinkers.json` | 53 | **new** `Sinker` |
| `keepnets-stringers.json` | 41 | **new** `Keepnet` |
| `addons.json` | 10 | **new** `Addon` |

### Verified cross-references (all clean)

- `fish.baitIds` → `baits.json` (119/121 resolve; 2 dangling, skip).
- `fish.lureIds` → `lure-types.json` (49/49) — recommendations are at the
  **lure-type** level, not individual lure SKUs.
- `lures.lureType` → `lure-types.json` by title (52/52 used names).
- `places.fishIds` / `monsterFishIds` → `fish.json` (238/238, 33/33).
- `spots.placeId` / `weathers.placeId` → `places.json` (27/28 each; 1 orphan
  references a removed place — skip with a warning).

### Overlap with what's already seeded

- **Fish**: 271 of 273 match existing fish by name. 2 are new (Caspian Roach,
  Volga Zander). 6 existing fish are **not** in the JSON (Greenback Cutthroat
  Trout, Guadalupe Bass, Longnose Dace, Shortnose Gar, Threadfin Shad, Yellow
  Bass) — leave these untouched.
- **Locations**: same 27 places.
- **Tackle / Spots / Weather**: entirely new — no models exist today.

## Design decisions

### FP IDs are the join key

Existing rows use autoincrement `id` and match by name; every relation in this
dataset joins by FP-Collective ID. So we add a nullable, unique `fpId` to `Fish`,
`Location`, and each new entity, and backfill `fpId` on the 271 existing fish /
27 places by name match. Primary keys are unchanged.

### Enrichment is additive-only (critical)

`fish.json` does **not** contain the curated columns the API already has
(`weight*`, `creditsPerKg*`, `farmingMetaTier`, `xpCurveNotes`, `notesFarming`).
The fish upsert must therefore write **only** the fields the JSON provides and
never null the curated ones. Likewise for `BitingPreference` — the JSON's
bait/lure relations are richer, but the seed must not touch the existing
hook-size / peak-time fields.

Concretely, for each matched fish set: `fpId`, `slug`, `imageUrl` always;
`scientificName` from `latinName` and `description` from `content` **only when
the existing value is empty** (`content` is HTML — strip tags and decode
entities first).

### FishLocation rebuild

Per-place fish presence + classes come from the `fishDetails` field (a stringified
JSON array of `{id, name, types, max_weight, price}`); `types`
(`young`/`common`/`trophy`/`unique`) → `classesPresent`. `max_weight` and `price`
are `0` across all 474 entries, so we ignore them. Presence stays **lake-wide**:
`specificSpot` remains the `'General'` sentinel (the JSON does not say which fish
are at which spot). `monsterFishIds` (never overlap `fishIds`) become
`FishLocation` rows with `classesPresent = ['Monster']`; those fish are inserted
into `Fish` with `isMonster = true`.

This makes the JSON pipeline the authoritative source of presence for these 27
places, superseding the markdown place seed. The markdown seed (`scripts/seed.ts`)
is left in place but flagged redundant — not deleted.

### Spots are game-space coordinates, not GPS

`lat`/`lng` are game-map coordinates (e.g. Skårland `lat = -1706.495`), not WGS84.
Store as `Decimal`; do not validate as real geographic coordinates. `placeId` is a
single-element array — take `[0]`, resolve to `Location` via `fpId`.

## Schema changes (`prisma/schema.prisma`)

### Modified models (additive)

- **Fish** — add `fpId Int? @unique @map("fp_id")`, `slug String? @unique @db.VarChar(120)`,
  `imageUrl String? @map("image_url") @db.Text`; add relations `baits FishBait[]`,
  `lureTypes FishLureType[]`.
- **Location** — add `fpId Int? @unique @map("fp_id")`, `slug String? @unique @db.VarChar(120)`,
  `imageUrl String? @map("image_url") @db.Text`; add relations `spots Spot[]`,
  `weathers Weather[]`.

### New models

- **Spot** — `id`, `fpId @unique`, `name`, `slug @unique`, `title`, `lat`, `lng`,
  `x`, `y` (all `Decimal`), `imageUrl?`, `locationId` → `Location`.
- **Weather** — `id`, `fpId @unique`, `name`, `slug @unique`, `title`, `value`
  (e.g. `clear-high`), `legacyValue` (`sunny`/`cloudy`/`rainy`/`partly`), `type`
  (`day`/`night`), `iconUrl?`, `chartUrl?`, `locationId` → `Location`.
- **Gear (9 models)** — shared base: `id`, `fpId @unique`, `title`, `slug @unique`,
  `imageUrl?`, `baseLevel Int`, `baitcoinLevel Int`, `tags String[]`. Extras:
  - `Bait` — `baitType`
  - `Boilie` — `baitType`, `diameterMm Int?`
  - `LureType` — (base only) + relation `fishes FishLureType[]`, `lures Lure[]`
  - `Lure` — `lureTypeId` → `LureType`, `color?`, `weightG Decimal?`, `lengthCm Decimal?`
  - `Hook` — `size`, `type`
  - `Jighead` — `size`, `weightG Decimal?`, `color?`
  - `Sinker` — `form`, `weightG Decimal?`, `color?`
  - `Keepnet` — `type`, `isFishFriendly Boolean`
  - `Addon` — `color?`, `lengthCm Decimal?`
- **Join tables**
  - `FishBait` — `@@id([fishId, baitId])`, FKs to `Fish` / `Bait` (source: `fish.baitIds`).
  - `FishLureType` — `@@id([fishId, lureTypeId])`, FKs to `Fish` / `LureType`
    (source: `fish.lureIds`).

All tables/columns use snake_case `@map`, per the existing convention.

### Note on `BitingPreference`

It keeps the single "best" bait/lure heuristic + hook sizes + peak-time text. The
new `FishBait` / `FishLureType` tables represent the **full** set of baits/lures a
fish bites on. Both coexist; `BitingPreference` is not modified in this work.

## Data files

Copy the 13 JSON files into the repo at `data/fp/*.json` (committed alongside the
existing markdown). They are large but static (`lures.json` 656K, `places.json`
608K); this matches how the markdown source is already vendored.

## Seed pipeline (`scripts/`, mirroring existing conventions)

Idempotent upserts, `import { prisma } from '../src/db.js'`, optional single-file
arg, run via `tsx`. **Order matters** (referential deps):

1. `scripts/seed-gear.ts` (`pnpm seed:gear`) — the 9 gear files; link each `Lure`
   to its `LureType` by name. Baits and lure-types must exist before fish links.
2. `scripts/seed-fp.ts` (`pnpm seed:fp`) — enrich `Fish` + `Location` (backfill
   `fpId`; insert the 2 new + monster fish); rebuild `FishLocation` from
   `fishDetails` + `monsterFishIds`; populate `FishBait` / `FishLureType`; seed
   `Spot` + `Weather`.

New `package.json` scripts: `seed:gear`, `seed:fp`.

## Route layer (`src/routes/`, mirroring `fish.ts`)

New CRUD resources, each with `FIELDS` / `FILTERS` / `SORTABLE` and the standard
`{ data, total, limit, offset }` envelope via `helpers.ts`:

- `/api/baits`, `/api/boilies`, `/api/lures`, `/api/lure-types`, `/api/hooks`,
  `/api/jigheads`, `/api/sinkers`, `/api/keepnets`, `/api/addons`
- `/api/spots` (filter `?locationId=`), `/api/weathers` (filter `?locationId=&type=`)

Useful per-resource filters: `?q=` (title search), `?baitType=`, `?lureType=`,
`?size=`, `?color=`, `?form=`, `?type=`. Mount each in `routes/index.ts`.
Existing `/api/fish` and `/api/locations` responses gain their new relations via
Prisma `include` on the by-id / by-name lookups.

## Docs

- Update `openapi.yaml` (new paths + schemas) and lint with
  `npx @redocly/cli lint openapi.yaml`.
- Update `CLAUDE.md` — data model, route layer, and seed-pipeline sections.

## Phasing (reviewable PRs, each branched off `main`)

**Status: all phases complete (2026-07-06), merged as #28–#32.**

1. **Schema + migration** — all model changes + new tables; `pnpm db:migrate`
   (`migrate dev`, **not** `db:push`). ✅ Done (#28).
2. **Gear** — `data/fp/*.json` + `seed-gear.ts` + gear routes + openapi. ✅ Done (#29).
3. **Fish/Location enrichment** — `seed-fp.ts` fish/location/fish-location half +
   `FishBait` / `FishLureType`. ✅ Done (#30).
4. **Spots + Weather** — seed half + routes. ✅ Done (#31).
5. **Docs + verification** — openapi, `CLAUDE.md`, redocly lint, plus a full
   end-to-end compose run (endpoints + idempotency + additive guarantee). ✅ Done (#32).

## Verification

- `pnpm typecheck` and `pnpm test` clean after each phase.
- End-to-end over the compose network (the Vitest suite mocks `src/db.js`, so it
  cannot catch driver / real-Prisma issues):

  ```bash
  docker compose up -d --build
  docker compose run --rm test node -e "fetch('http://app:8080/api/baits').then(r => console.log(r.status))"
  docker compose down -v
  ```

- Idempotency: run each seed twice; row counts unchanged on the second run.
- Spot-check the additive guarantee: a fish with curated weights/credits still
  has them after `seed-fp.ts` runs.

## Open questions / risks (resolved)

- **Markdown place seed** — **kept, not redundant.** `seed-fp.ts` only *enriches*
  existing Locations (it skips any it can't find by name), so the markdown seed is a
  required prerequisite that creates them plus their curated
  `region`/`waterwayType`/`unlockLevel`. A clarifying note was added to
  `scripts/seed.ts` (#32) instead of a "deprecated" label.
- **`description` conflict** — **confirmed.** Keep the existing markdown descriptions;
  fill only empties from the JSON `content` (tag-stripped).
- **`region` / `waterwayType` / `unlockLevel`** — **confirmed not overwritten.**
  `seed-fp.ts`'s Location update writes only `fpId` / `slug` / `imageUrl`.
