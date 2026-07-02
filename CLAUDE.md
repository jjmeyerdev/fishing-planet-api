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

## ESM / import conventions

`type: module` + `moduleResolution: Bundler` + `verbatimModuleSyntax`. Relative
imports **must** carry a `.js` extension even when the source is `.ts`
(e.g. `import { app } from './app.js'`). Type-only imports must use
`import type`. `tsconfig` `rootDir` is `src/`, so `scripts/` is excluded from the
build and only ever run through `tsx`.

## Data model

Four models (`prisma/schema.prisma`), all with snake_case `@map` table/column names:

- **Fish** — game-data fields (weights in kg, credit rates, farming notes).
  Unique on `commonName`. Has optional 1:1 `BitingPreference` and many `FishLocation`.
- **Location** — unique `name`, plus `region`, `waterwayType`, `unlockLevel`.
- **FishLocation** — join table with a **composite primary key**
  `(fishId, locationId, specificSpot)` and a `classesPresent` string array.
- **BitingPreference** — keyed 1:1 on `fishId`; array fields for baits/lures/colors
  and peak-time text per weather.

## Route layer (`src/routes/`)

`app.ts` mounts `routes` under `/api`; `routes/index.ts` mounts each resource
(`/fish`, `/locations`, `/fish-locations`, `/biting-preferences`). Every resource
file follows the same CRUD shape and two shared helpers in `routes/helpers.ts`:

- `pick(body, FIELDS)` — whitelists a fixed `FIELDS` tuple from the JSON body so
  clients can't set arbitrary columns. Each route defines its own `FIELDS`.
- `isNotFound(e)` — detects Prisma error `P2025` to translate a missing
  update/delete target into a 404.

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
