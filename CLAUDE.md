# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Hono REST API (Node.js + TypeScript, ESM) exposing Fishing Planet game data —
fish, locations, their many-to-many presence, and per-fish biting preferences —
backed by PostgreSQL through Prisma 7 with the `@prisma/adapter-pg` driver adapter.

## Commands

```bash
pnpm install            # runs `prisma generate` via postinstall
pnpm dev                # tsx watch, hot-reload dev server
pnpm build              # prisma generate + tsc → dist/
pnpm start              # node dist/index.js
pnpm typecheck          # type-check src + tests (no emit)
pnpm test               # run the Vitest suite (pnpm test:watch to watch)
pnpm db:push            # push schema to DB (no migration files)
pnpm db:migrate         # create + apply a dev migration
pnpm db:generate        # regenerate the Prisma client
pnpm seed               # seed every data/locations/*.md
pnpm seed data/locations/x.md   # seed a single place file
pnpm seed:biting        # seed biting_preferences from every data/fish/*.md
pnpm seed:biting data/fish/x.md   # seed a single fish file
pnpm seed:gear          # seed the tackle catalog from data/fp/*.json
pnpm seed:gear baits    # seed a single gear entity (baits|boilies|lure-types|…)
pnpm seed:fp            # enrich fish/locations + rebuild fish_locations & links
pnpm seed:spots         # seed geo spots + per-location weather from data/fp/*.json
pnpm seed:spots spots   # seed a single entity (spots|weathers)
```

The static checks are `pnpm typecheck` (types, including `tests/`) and `pnpm test`
(the Vitest suite); no linter is configured. The server listens on `PORT`
(default **8080**).

## Prisma 7 configuration (non-obvious)

Prisma 7 does **not** read the connection URL from `schema.prisma`. `DATABASE_URL`
is wired in two separate places, both loading `.env` via `dotenv`:

- `prisma.config.ts` — supplies the URL to the Prisma **CLI** (migrate / db push).
- `src/db.ts` — builds a `PrismaPg` adapter from the URL for the **runtime** client.

The generated client is emitted to `src/generated/prisma/` (git-ignored) by
`generator client` in the schema. Import Prisma types/client from
`../generated/prisma/client.js`, not from `@prisma/client`. After any schema
change, regenerate before typechecking or the import will be stale.

## Migrations

The schema is now tracked by committed migration files in `prisma/migrations/`
(baseline: `..._init`). Change the schema with `pnpm db:migrate`
(`prisma migrate dev`), which generates a new migration and applies it — **do
not** use `pnpm db:push` on this project any more: it force-syncs the schema
without a migration file, causing drift that `migrate deploy` later flags.

`prisma migrate deploy` applies committed migrations idempotently and is what the
Docker Compose `init` service runs before the app starts. The slim runtime image
has no Prisma CLI, so migrations only ever run from the builder image (compose
`init`) or the host, never from the running app container.

## End-to-end verification

`pnpm test` mocks `src/db.js`, so it never touches a database — it can't catch
anything that depends on the real driver adapter or live Prisma error codes
(e.g. `P2002`/`P2003`/validation → 4xx). To verify against the real stack, bring
it up and hit the endpoints **over the compose network**, not host `curl` (the
slim runtime image has no `curl`, and the app is only reachable on the published
`APP_PORT` or by service name inside the network):

```bash
docker compose up -d --build     # Postgres → migrations (init) → app
# ad-hoc check from a node container on the network (reuses the smoke `test`
# service, which already sets BASE_URL=http://app:8080 and waits for health):
docker compose run --rm test node -e "fetch('http://app:8080/api/fish').then(r => console.log(r.status))"
docker compose down -v           # tear down, including the pgdata volume
```

For a longer check, mount a script: `docker compose run --rm -v ./x.mjs:/x.mjs:ro
test node /x.mjs`. Set `APP_PORT`/`DB_PORT` to avoid clashing with anything on
`8080`/`5432`.

## Deployment (Vercel)

Deployed to Vercel as one Node **serverless function** wrapping the same Hono
`app`. `api/index.ts` is the entry — `export default handle(app)` from
**`@hono/node-server/vercel`** (the Node adapter). Do **not** use `hono/vercel`'s
`handle`: that's the Edge adapter, and on the Node runtime it hands Hono a Node
request whose headers lack `.get`, so every request throws
`this.raw.headers.get is not a function`. Edge isn't viable anyway — `pg` / the
Prisma driver adapter need Node. `src/index.ts` (the `@hono/node-server` listener)
is unused on Vercel but still drives the container/local server.

`vercel.json` configures it as an API-only project:

- `framework: null` — otherwise Vercel auto-detects "Hono" and tries to run
  `src/app.ts` itself as a function (`Invalid export … must be a function`).
- `rewrites: /(.*) → /api` — every path (`/health`, `/ready`, `/docs`, `/metrics`,
  `/api/*`) hits the one function, which does its own routing.
- `buildCommand: prisma generate` + `outputDirectory: public` (an empty
  `public/.gitkeep`) — no `tsc`/static output; `@vercel/node` bundles the function
  and its `src/**` + generated-client imports itself. `postinstall` also runs
  `prisma generate`.
- `functions."api/index.ts".includeFiles: openapi.yaml` — bundles the spec so
  `/openapi.yaml` + `/docs` resolve (they read it relative to the module).

**Git integration** is connected: push to `main` → production, each PR → a preview.
Config lives in the Vercel project, not `.env`: `DATABASE_URL` (Neon **pooled**
`-pooler` string), `API_KEYS` (set → writes gated), optional `RATE_LIMIT_*`.
Migrations do **not** run on deploy — apply them out-of-band with `prisma migrate
deploy` against a **direct** (non-pooled) URL. Serverless caveats: the in-memory
rate limiter and `/metrics` are per-instance (best-effort / not aggregated). Live
at <https://fishing-planet-api.vercel.app>.

## ESM / import conventions

`type: module` + `moduleResolution: Bundler` + `verbatimModuleSyntax`. Relative
imports **must** carry a `.js` extension even when the source is `.ts`
(e.g. `import { app } from './app.js'`). Type-only imports must use
`import type`. `tsconfig` `rootDir` is `src/`, so `scripts/` is excluded from the
build and only ever run through `tsx`.

## Data model

The schema (`prisma/schema.prisma`) grew from four core models to the full
FP-Collective dataset; all use snake_case `@map` names. Core models:

- **Fish** — game-data fields (weights in kg, credit rates, farming notes).
  Unique on `commonName`. Optional 1:1 `BitingPreference`, many `FishLocation`,
  and many-to-many `baits` (`FishBait`) / `lureTypes` (`FishLureType`). Also
  carries FP-Collective `fpId`/`slug`/`imageUrl`.
- **Location** — unique `name`, plus `region`, `waterwayType`, `unlockLevel`,
  FP-Collective `fpId`/`slug`/`imageUrl`, and many `spots` / `weathers`.
- **FishLocation** — join table with a **composite primary key**
  `(fishId, locationId, specificSpot)` and a `classesPresent` string array
  (`Young`/`Common`/`Trophy`/`Unique`, or `Monster` for monster presence).
- **BitingPreference** — keyed 1:1 on `fishId`; array fields for baits/lures/colors
  and peak-time text per weather.

The FP-Collective import added: the tackle catalog (`Bait`, `Boilie`, `LureType`,
`Lure`, `Hook`, `Jighead`, `Sinker`, `Keepnet`, `Addon`), geo `Spot` and
per-location `Weather`, and the `FishBait` / `FishLureType` join tables — each
keyed by a unique FP-Collective `fpId`. `GET /api/fish/:id` and `/by-name/:name`
embed the biting preference plus these `baits` / `lureTypes` relations.

## Route layer (`src/routes/`)

`app.ts` mounts `routes` under `/api`; `routes/index.ts` mounts each resource
(`/fish`, `/locations`, `/fish-locations`, `/biting-preferences`, plus the tackle
catalog: `/baits`, `/boilies`, `/lure-types`, `/lures`, `/hooks`, `/jigheads`,
`/sinkers`, `/keepnets`, `/addons`; plus geo `/spots` and per-location
`/weathers`). `app.ts` also
exposes `GET /health` (liveness, DB-free) and `GET /ready`
(readiness — runs `SELECT 1`, `503` when the DB is unreachable); the Compose
healthcheck targets `/ready`. `src/db.ts` sizes the pg pool (`max`, idle /
connection timeouts) so an unreachable DB fails fast instead of hanging.
`src/docs.ts` serves Swagger UI at `/docs` (CDN assets) and the raw
`openapi.yaml` at `/openapi.yaml` (read relative to the module, so it resolves
under both `tsx` and the compiled build; the Dockerfile copies it into the image).
`src/index.ts` (the entry) traps `SIGTERM`/`SIGINT` and drains gracefully:
`server.close()` (finish in-flight) → `prisma.$disconnect()` → exit, with a
`SHUTDOWN_TIMEOUT_MS` backstop. Signal handlers live here, not in `app.ts`, so
tests (which import `app`) don't register them.

`src/logger.ts` provides `log()` (one JSON line to stdout; `LOG_SILENT` mutes it,
set by `pnpm test`) and `requestLogger()`, which assigns/echoes an `X-Request-Id`
(stored on the context as `requestId`, typed via `LogEnv`) and logs one line per
request; `onError` logs the structured error (so `requestLogger` skips its line
when `c.error` is set, to avoid a duplicate). `src/metrics.ts` (prom-client)
records `http_requests_total` + `http_request_duration_seconds` labeled by the
matched route pattern (`c.req.routePath`, low cardinality) and serves `/metrics`
with default process metrics. `src/rateLimit.ts` is an in-memory fixed-window limiter applied to `/api/*`
(`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS` env; `max=0` disables — the `pnpm test`
script sets it so the suite isn't throttled). `src/auth.ts` gates writes
(POST/PATCH/DELETE) on `/api/*` behind an API key (`Authorization: Bearer`, keys
from the comma-separated `API_KEYS`); reads are public and an empty `API_KEYS`
disables it (the `pnpm test` script clears it, so write tests aren't blocked).

Every resource file follows the same CRUD shape and shares helpers in
`routes/helpers.ts`. The nine tackle resources are uniform id-in-path CRUD, so
they share one `routes/crud.ts` `crudResource({ model, fields, filters, sortable })`
factory (each route file is just its config) instead of a hand-written file each;
the four bespoke resources keep their own routers for their quirks (fish/locations
`by-name`, the `fish-locations` composite key). The helpers that reject bad input
**throw** a Hono
`HTTPException`; `app.ts`'s `onError` renders that as `{ error }` with its
status. A Prisma connection failure (`isConnectionError`: `P1001`/`P1002`/
`P1008`/`P1017`) becomes a `503`; any other unexpected error is logged and
returned as a generic `500` (so internal Prisma messages aren't leaked):

- `readJson(c)` — parse the JSON body into an object, or `400` if it's malformed
  or not a JSON object.
- `pick(body, FIELDS)` — whitelists a fixed `FIELDS` tuple from the JSON body so
  clients can't set arbitrary columns. Each route defines its own `FIELDS`.
- `intParam(c, name)` / `intQuery(c, name)` — read a required route param / an
  optional query filter as an integer, or `400` (`intQuery` returns `undefined`
  when the param is absent, rather than forwarding `NaN` into a query).
- `pageParams(c)` — parse `?limit=` (default 50, max 100) / `?offset=` (default
  0) for the list endpoints, or `400` out of range. Every `list` returns a
  `{ data, total, limit, offset }` envelope (`take`/`skip` + a `count`).
- `buildWhere(c, FILTERS)` — build a Prisma `where` from a per-route `FILTERS`
  whitelist (`string`/`search`/`int`/`boolean`; `search` is a case-insensitive
  `contains`). Unknown params are ignored so filters coexist with pagination;
  a bad int/boolean is `400`. The same `where` feeds `findMany` and `count`.
- `sortOrder(c, SORTABLE)` — parse `?sort=&order=` against a per-route
  `SORTABLE` whitelist into a Prisma `orderBy`, or `undefined` so the route
  keeps its default order. `order` defaults to asc; an unknown field or bad
  order value is `400`.
- `orClientError(op)` — run a Prisma write, translating its expected failures
  into 4xx instead of a blanket 500: `P2025` missing row → `404`, `P2002` unique
  → `409`, `P2003` foreign key → `400`, and a `PrismaClientValidationError`
  (missing/mistyped field) → `400`. `isNotFound(e)` (the `P2025` check) backs it.

The API is described by a hand-maintained `openapi.yaml` (OpenAPI 3.0) at the
repo root — update it when routes, params, or schemas change, and lint with
`npx @redocly/cli lint openapi.yaml` (config in `redocly.yaml` waives rules that
don't fit: no auth, meta endpoints without 4xx, the 3.0 nullable-`$ref` idiom).

`fish-locations` is the exception to id-in-path CRUD: because its PK is composite,
`PATCH`/`DELETE` identify the row via `?fishId=&locationId=&specificSpot=` query
params (see `keyFromQuery`), and `GET` filters by optional `fishId`/`locationId`.

## Seed pipeline (`scripts/seed.ts`)

Parses FP-Collective place pages in `data/locations/*.md` (markdown scraped from the site)
and upserts Locations, Fish, and FishLocations. Idempotent. Notes:

- Place pages list fish **lake-wide**, not per spot, so every seeded FishLocation
  uses the sentinel `specificSpot = 'General'` (`LAKE_WIDE_SPOT`).
- `waterwayType` isn't on the page: inferred from name keywords, with explicit
  `WATERWAY_OVERRIDES` for locations whose name lacks a water-body word.
- Files ending `-old.md` are skipped as superseded map versions.
- The fish-entry regex `FISH_ENTRY` expects the `[classes **Name**](url)` markup;
  changing the source markdown format will break parsing.

## Biting-preferences seed pipeline (`scripts/seed-biting-preferences.ts`)

Parses FP-Collective **per-fish** pages in `data/fish/*.md` (one file per fish,
scraped from `fp-collective.com/fish/<slug>`) and upserts one `BitingPreference`
per fish. Idempotent. Separate from the place-file pipeline above. Notes:

- Rows are matched to `Fish` by the file's `# <commonName>` heading (which equals
  `Fish.commonName`), **not** the filename — so slug quirks never affect seeding.
- Only three fields come from the page's "How to catch" prose: the single best
  bait, the single best lure (each stored as a one-element array), and the bait
  hook size (written to both `hookSizeMin` and `hookSizeMax`). Two regexes,
  `BAIT` and `LURE`, drive the extraction.
- Lure-only fish have no bait sentence, so their hook size is null; bait-only fish
  have no lure. A file with neither is skipped with a warning.
- Not sourced from the fish page (left null/empty): `depthZone`, the three
  `*PeakTimes` (those are per-place weather data, not per-fish), and
  `preferredLureColors` (intentionally empty — flagged disputed in the schema).
- The per-fish pages are JS-rendered, so the prose is absent from a plain fetch;
  the `data/fish/*.md` files are pre-scraped via Firecrawl (with `waitFor`).

## Tackle-catalog seed pipeline (`scripts/seed-gear.ts`)

Seeds the nine tackle entities (`Bait`, `Boilie`, `LureType`, `Lure`, `Hook`,
`Jighead`, `Sinker`, `Keepnet`, `Addon`) from the **structured** FP-Collective
JSON vendored in `data/fp/*.json` (the same source as the markdown, straight from
their API). Idempotent — every row upserts on `fpId` (the FP-Collective id).
Notes:

- One JSON file per entity (`baits.json`, `boilies-pellets.json`,
  `lure-types.json`, `lures.json`, `hooks.json`, `jigheads.json`, `sinkers.json`,
  `keepnets-stringers.json`, `addons.json`). `pnpm seed:gear <name>` seeds just one.
- `lure-types` seed **before** `lures`: each lure resolves its `lureTypeId` by
  matching the source `lureType` name to a seeded `LureType.title` (nullable FK;
  an unmatched name logs a warning and leaves it null).
- Field mapping flattens the source `specs` (`weight`/`length`/`diameter` →
  `weightG`/`lengthCm`/`diameterMm`) and normalizes empty strings (e.g. `color: ""`)
  to null. `image` → `imageUrl`, `id` → `fpId`.
- `data/fp/` also holds `fish.json`, `places.json`, `spots.json`, `weathers.json`
  for later phases (fish/location enrichment, spots, weather) — not used by this
  pipeline.

## Fish/Location enrichment seed pipeline (`scripts/seed-fp.ts`)

Enriches the existing `Fish`/`Location` rows from `data/fp/fish.json` +
`places.json`, rebuilds `FishLocation` presence, and populates the `FishBait` /
`FishLureType` links. Idempotent. **Run `pnpm seed:gear` first** — the links
resolve baits/lure-types by `fpId`. Notes:

- **Matching:** fish by `commonName` == `fish.json` title (271 match; Caspian Roach
  and Volga Zander are created); locations by `name`, normalizing a trailing
  ` (reworked)` suffix three DB names carry that the place titles don't.
- **Additive for curated columns:** `fpId`/`slug`/`imageUrl` are always set;
  `scientificName` (from `latinName`) and `description` (from HTML `content`,
  tag-stripped) fill **only when currently empty**; `isMonster` is only ever set
  true (a fish in any place's `monsterFishIds`), never cleared. Weights, credit
  rates, and farming fields are never touched (they aren't in the JSON).
- **FishLocation** is rebuilt atomically per run: parse each place's `fishDetails`
  (the `types` → `classesPresent`), plus a `['Monster']` row per `monsterFishId`,
  all at the `General` spot; a `$transaction` deletes the old `General` rows for
  those locations and `createMany`s the fresh set.
- **Links** are a full rebuild (`deleteMany` + `createMany`): `fish.baitIds` →
  `FishBait` (2 baitIds don't resolve and are skipped), `fish.lureIds` →
  `FishLureType` (lure recommendations are at the lure-**type** level).

## Spots/Weather seed pipeline (`scripts/seed-spots.ts`)

Seeds geo `Spot` and per-location `Weather` from `data/fp/spots.json` /
`weathers.json`. Idempotent — every row upserts on `fpId`. **Run `pnpm seed:fp`
first**: each row resolves its `Location` by matching the source `placeId` to
`Location.fpId`, which `seed:fp` backfills. Notes:

- `pnpm seed:spots` seeds both; `pnpm seed:spots <name>` seeds just one
  (`spots|weathers`).
- `placeId` is a single-element array — `[0]` is matched to a seeded `Location`
  by `fpId`. Rows whose place isn't seeded are skipped with a count (one removed
  place, `fpId 204`, orphans 4 spots + 6 weathers).
- Field mapping: `id` → `fpId`, `image` → `imageUrl` (Spot), `icon`/`chart` →
  `iconUrl`/`chartUrl` (Weather). Spot `lat`/`lng`/`x`/`y` are game-map
  coordinates stored as `Decimal`, **not** WGS84.

## Fishing Planet Wiki ingestion (`scripts/wiki/`)

A **standalone** dataset scraped from the Fishing Planet Wiki
(`wiki.fishingplanet.com`), kept entirely separate from the FP-Collective models
in `wiki_*` tables. Covers **species, the tackle "gear" categories** (reels,
rods, lines, hooks, sinkers/feeders, bobbers, lures) **and consumables** (baits +
boilies/pellets, groundbaits), plus brands and technologies derived from reels +
rods. Three decoupled, re-runnable stages:

- `pnpm wiki:crawl` — scrape → disk cache (`.cache/wiki/pages/`, git-ignored) via
  the Firecrawl SDK (`FIRECRAWL_API_KEY` in `.env`). Throttled (`p-limit` 2 +
  exponential backoff) and **resumable** — a cached URL is never re-fetched.
  Species are discovered by scraping the 19 family pages and taking their
  resident-species links; the gear categories are seeded from a hardcoded list of
  their sub-type pages (`GEAR_CATEGORIES` in `crawl.ts`: 3 reel + 37 gear + 6 baits
  + 5 groundbait pages), each tagged with a `category` + `subtype` parse routes on.
- `pnpm wiki:parse` — cache → `.cache/wiki/parsed.json`. **Pure** (no network/DB),
  so parsers iterate freely. Deterministic markdown parsing, no per-page LLM. One
  parser per category (`lib/parse-*.ts`) over shared primitives in `lib/gear.ts`
  (brand-from-`/Brands`-link, price-by-icon → Credits/Baitcoins/reward-note,
  `Required level`→unlock, `foldRows`/`pick` for label→value tables with a
  broadcast-aware last-N-cell read). Layouts differ per category: reels/rods/
  sinkers/plain-hooks are block-per-model with per-variant value columns; rods key
  variants off the `Length`/`Name` row (shared vs per-variant rows) and reuse
  brand + technologies; lines are a 2-D (diameter × spool-size) grid split into
  `Regular`/`Exclusive`; jig-heads/bobbers/lures/flat-baits are one-row-per-item
  (lures × color × size); boilies/pellets reuse the block-per-model layout but
  flatten each variant column to its own row (baits pages carry no brand/tech).
  Groundbaits mix both: flat catalogs (aromas/particles, with a brand link) +
  flattened block mixes (carp/base/method), all into one `wiki_groundbaits` table.
  Ranges/fractions (`1/32 - 1/4`, `3 + 3`, `6'6" NE`) stay strings.
  A final `uniqueSlugs` pass suffixes genuinely-distinct slug collisions.
- `pnpm wiki:load` — `parsed.json` → Neon. Idempotent upserts on `slug`; child
  rows (variants, links) replaced per parent; brand/technology resolved by slug.

Each gear category is a parent table (`wiki_rods`, `wiki_lines`, …) plus a
per-variant child (`wiki_rod_variants`, …) where a model spans variants; hooks and
sinkers use a `kind` discriminator (hook/jighead, sinker/feeder); bobbers, baits,
boilies, and groundbaits are flat (`wiki_bobbers`/`wiki_baits`/`wiki_boilies`/
`wiki_groundbaits`, one row per item, no child; buoys out of scope). A species'
cross-category links
(baits/lures/locations) point at categories not modeled here, so they stay raw
name+slug in `wiki_species_*` and FK-resolve later. `scripts/wiki/lib/` holds the
cache, markdown helpers, the shared `gear.ts` primitives, the per-category parsers,
and the parse↔load type contract. Big pages (reel/rod sub-type pages run
~130–400 KB) are only ever handled in the script — never read into an agent's
context; structural analysis of a new category is best done in a subagent.
