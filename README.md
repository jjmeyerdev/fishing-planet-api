# fishing-planet-api

A [Hono](https://hono.dev) API on Node.js + TypeScript, backed by PostgreSQL via [Prisma 7](https://www.prisma.io) (driver adapter `@prisma/adapter-pg`).

## Requirements

- Node.js 20+
- pnpm
- A PostgreSQL database

## Getting started

```bash
pnpm install
cp .env.example .env        # then set DATABASE_URL
pnpm db:push                # create tables from the Prisma schema
pnpm seed                   # (optional) load data/*.md place pages
pnpm dev
```

The server starts at <http://localhost:8080> (override with `PORT`).

## Scripts

- `pnpm dev` — start the dev server with hot reload
- `pnpm build` — generate the Prisma client and compile to `dist/`
- `pnpm start` — run the compiled server
- `pnpm typecheck` — type-check without emitting
- `pnpm db:push` — push the Prisma schema to the database (no migration files)
- `pnpm db:migrate` — create and apply a dev migration
- `pnpm db:generate` — regenerate the Prisma client
- `pnpm seed` — seed locations, fish and fish-locations from `data/*.md` (pass a single file to seed just that one)

## Seeding

`scripts/seed.ts` parses [FP-Collective](https://fp-collective.com) place pages
stored as markdown in `data/` and upserts them, so re-running is idempotent. A
few things the place pages don't provide are filled in by the script:

- fish presence is listed lake-wide, so every seeded `fish_locations` row uses
  the sentinel `specificSpot` value `General`;
- `waterway_type` is inferred from the location name, with explicit overrides for
  names that lack a water-body keyword;
- files ending in `-old.md` are skipped as superseded versions.

## Database config (Prisma 7)

Prisma 7 no longer reads the connection URL from `schema.prisma`. Instead:

- `prisma.config.ts` supplies `DATABASE_URL` to the CLI (migrations).
- `src/db.ts` builds a `@prisma/adapter-pg` adapter from `DATABASE_URL` and passes it to `PrismaClient`.

Both read `DATABASE_URL` from `.env`.

## Structure

```text
data/                FP-Collective place pages (markdown) used by the seed script
prisma/
  schema.prisma      models: Fish, Location, FishLocation, BitingPreference
prisma.config.ts     Prisma CLI config (schema path, migrations, datasource url)
scripts/
  seed.ts            parse data/*.md → upsert locations/fish/fish-locations
  stats.ts           print row counts by table and waterway type
src/
  index.ts           entry point — starts the Node server
  app.ts             Hono app, middleware, error handler
  db.ts              Prisma client + pg driver adapter
  generated/prisma/  generated Prisma client (git-ignored)
  routes/
    index.ts         mounts resource routes under /api
    fish.ts          /api/fish
    locations.ts     /api/locations
    fishLocations.ts /api/fish-locations
    bitingPreferences.ts  /api/biting-preferences
    helpers.ts       shared field-picking / error helpers
```

## Endpoints

Base: `GET /` (info), `GET /health`.

| Resource | Base path | Operations |
| --- | --- | --- |
| Fish | `/api/fish` | list, get `:id` (includes biting preference), create, update `:id`, delete `:id` |
| Locations | `/api/locations` | list, get `:id`, create, update `:id`, delete `:id` |
| Biting preferences | `/api/biting-preferences` | list, get `:fishId`, create, update `:fishId`, delete `:fishId` |
| Fish ↔ Location | `/api/fish-locations` | list (filter `?fishId=&locationId=`), create, update / delete via `?fishId=&locationId=&specificSpot=` |

The `fish_locations` join has a composite key `(fishId, locationId, specificSpot)`, so update and delete take those three as query params rather than a path id.
