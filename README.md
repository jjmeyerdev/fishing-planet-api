# fishing-planet-api

[![CI](https://github.com/jjmeyerdev/fishing-planet-api/actions/workflows/ci.yml/badge.svg)](https://github.com/jjmeyerdev/fishing-planet-api/actions/workflows/ci.yml)
[![Smoke](https://github.com/jjmeyerdev/fishing-planet-api/actions/workflows/smoke.yml/badge.svg)](https://github.com/jjmeyerdev/fishing-planet-api/actions/workflows/smoke.yml)

A [Hono](https://hono.dev) API on Node.js + TypeScript, backed by PostgreSQL via [Prisma 7](https://www.prisma.io) (driver adapter `@prisma/adapter-pg`).

**Live API:** <https://fishing-planet-api.vercel.app> · interactive docs (Swagger UI) at **[`/docs`](https://fishing-planet-api.vercel.app/docs)**.

## Requirements

- Node.js 22+
- pnpm
- A PostgreSQL database

## Getting started

```bash
pnpm install
cp .env.example .env        # then set DATABASE_URL
pnpm db:migrate             # apply migrations to create the schema
pnpm seed                   # (optional) load data/locations/*.md place pages
pnpm seed:biting            # (optional) load data/fish/*.md biting preferences
pnpm dev
```

The server starts at <http://localhost:8080> (override with `PORT`).

## Scripts

- `pnpm dev` — start the dev server with hot reload
- `pnpm build` — generate the Prisma client and compile to `dist/`
- `pnpm start` — run the compiled server
- `pnpm typecheck` — type-check without emitting
- `pnpm test` — run the Vitest suite (`pnpm test:watch` to watch)
- `pnpm db:migrate` — create and apply a dev migration (the tracked way to change the schema)
- `pnpm db:push` — force-sync the schema with no migration file; avoid on this project, as it drifts from the committed migrations
- `pnpm db:generate` — regenerate the Prisma client
- `pnpm seed` — seed locations, fish and fish-locations from `data/locations/*.md` (pass a single file to seed just that one)
- `pnpm seed:biting` — seed biting preferences from `data/fish/*.md` (pass a single file to seed just that one)
- `pnpm seed:gear` — seed the tackle catalog (baits, lures, hooks, …) from `data/fp/*.json` (pass one entity name to seed just that one)
- `pnpm seed:fp` — enrich fish/locations from `data/fp/*.json` and rebuild the fish-location + bait/lure-type links
- `pnpm seed:spots` — seed geo spots and per-location weather from `data/fp/*.json`
- `pnpm wiki:crawl` / `wiki:parse` / `wiki:load` — the three-stage Fishing Planet Wiki ingestion (scrape → parse → load); see [Wiki dataset](#wiki-dataset)

## Seeding

`scripts/seed.ts` parses [FP-Collective](https://fp-collective.com) place pages
stored as markdown in `data/locations/` and upserts them, so re-running is
idempotent. A few things the place pages don't provide are filled in by the
script:

- fish presence is listed lake-wide, so every seeded `fish_locations` row uses
  the sentinel `specificSpot` value `General`;
- `waterway_type` is inferred from the location name, with explicit overrides for
  names that lack a water-body keyword;
- files ending in `-old.md` are skipped as superseded versions.

`scripts/seed-biting-preferences.ts` is a separate, also-idempotent pipeline that
parses the per-fish pages in `data/fish/` and upserts one `biting_preferences`
row per fish, matched to `Fish` by the file's `# <commonName>` heading. It fills
only the best bait, best lure, and bait hook size from each page's prose.

### FP-Collective structured import

Beyond the scraped markdown, the bulk of the game data comes from FP-Collective's
structured JSON (vendored in `data/fp/*.json`). Three idempotent, order-dependent
seeds populate it:

1. `pnpm seed:gear` — the tackle catalog (baits, boilies, lure types, lures,
   hooks, jigheads, sinkers, keepnets, addons), upserted on the FP-Collective id.
2. `pnpm seed:fp` — enriches the existing fish/locations, rebuilds `fish_locations`
   presence, and links fish to baits/lure-types (**run `seed:gear` first**, since
   the links resolve gear by id).
3. `pnpm seed:spots` — geo spots and per-location weather (**run `seed:fp` first**,
   which backfills the `Location.fpId` each row matches on).

### Wiki dataset

A second, standalone dataset is scraped from the [Fishing Planet
Wiki](https://wiki.fishingplanet.com) into separate `wiki_*` tables, kept apart
from the FP-Collective models. It covers species, every tackle/gear category,
consumables, equipment, transport, rigs, and brands/technologies. Three decoupled,
re-runnable stages, each reading the previous one's output:

1. `pnpm wiki:crawl` — scrape pages to an on-disk cache (`.cache/wiki/`,
   git-ignored) via Firecrawl (`FIRECRAWL_API_KEY` in `.env`); resumable, so a
   cached URL is never re-fetched.
2. `pnpm wiki:parse` — parse the cache to `.cache/wiki/parsed.json` (pure — no
   network or database).
3. `pnpm wiki:load` — upsert `parsed.json` into the database.

The wiki data is exposed read-only under `/api/wiki` (see [Wiki API](#wiki-api)).

## Database config (Prisma 7)

Prisma 7 no longer reads the connection URL from `schema.prisma`. Instead:

- `prisma.config.ts` supplies `DATABASE_URL` to the CLI (migrations).
- `src/db.ts` builds a `@prisma/adapter-pg` adapter from `DATABASE_URL` and passes it to `PrismaClient`.

Both read `DATABASE_URL` from `.env`.

## Docker

Build and run the API alone against an existing database:

```bash
docker build -t fishing-planet-api .
docker run -p 8080:8080 -e DATABASE_URL=postgresql://… fishing-planet-api
```

Or bring up the whole stack with Compose. An `init` service applies the Prisma
migrations (`prisma migrate deploy`, using the builder image, which has the CLI)
before the API starts, so a single command is self-contained:

```bash
docker compose up -d --build       # Postgres → migrations (init) → API on :8080
```

Load the data with the one-shot `seed` service (bind-mounts `data/` and
`scripts/`, which the slim image omits; waits for migrations first):

```bash
docker compose --profile seed up --build seed
```

To run the smoke-test service, which waits for the app to report healthy:

```bash
docker compose --profile test run --build --rm test
```

Credentials default to the `.env.example` values; override `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`, and the published `APP_PORT` / `DB_PORT` via a
`.env` file or the shell.

## Deployment (Vercel)

Deployed to Vercel as a single Node serverless function wrapping the Hono app
(`api/index.ts` via `@hono/node-server/vercel`), with `vercel.json` rewriting all
paths to it. Push to `main` deploys production; each PR gets a preview URL.

Set these in the Vercel project (not `.env`):

- `DATABASE_URL` — the Neon **pooled** (`-pooler`) connection string
- `API_KEYS` — comma-separated keys, so writes are gated (see [Auth](#auth))

Migrations don't run on deploy; apply them with `prisma migrate deploy` against a
**direct** (non-pooled) URL. On serverless the in-memory rate limiter and
`/metrics` are per-instance. Live at <https://fishing-planet-api.vercel.app>
(Swagger UI at `/docs`).

See [`docs/deployment.md`](docs/deployment.md) for the full deployment guide.

## Structure

```text
data/
  locations/         FP-Collective place pages (markdown) — source for pnpm seed
  fish/              FP-Collective per-fish pages (markdown) — source for pnpm seed:biting
  fp/                FP-Collective structured JSON — source for seed:gear/seed:fp/seed:spots
prisma/
  schema.prisma      FP-Collective models (Fish, Location, tackle catalog, spots,
                     weather) + the standalone wiki_* models
prisma.config.ts     Prisma CLI config (schema path, migrations, datasource url)
scripts/
  seed.ts            parse data/locations/*.md → upsert locations/fish/fish-locations
  seed-biting-preferences.ts  parse data/fish/*.md → upsert biting_preferences
  seed-gear.ts       data/fp/*.json → upsert the tackle catalog
  seed-fp.ts         data/fp/*.json → enrich fish/locations, rebuild links
  seed-spots.ts      data/fp/*.json → upsert geo spots + per-location weather
  wiki/              Fishing Planet Wiki ingestion (crawl → parse → load)
  stats.ts           print row counts by table and waterway type
src/
  index.ts           entry point — starts the Node server
  app.ts             Hono app, middleware, error handler
  db.ts              Prisma client + pg driver adapter
  generated/prisma/  generated Prisma client (git-ignored)
  routes/
    index.ts         mounts resource routes under /api
    fish.ts, locations.ts, fishLocations.ts, bitingPreferences.ts   core resources
    baits.ts, boilies.ts, lureTypes.ts, lures.ts, hooks.ts, …       tackle catalog
    spots.ts, weathers.ts   geo spots + per-location weather
    crud.ts          shared id-in-path CRUD factory for the uniform resources
    wiki/            read-only /api/wiki API (read.ts list+detail, search.ts)
    helpers.ts       shared field-picking / error helpers
```

## Endpoints

Base: `GET /` (info), `GET /health` (liveness — process is up), `GET /ready`
(readiness — pings the DB; `503` when unreachable). A DB connection failure
during any request returns `503`, not `500`.

Every resource path is served under both **`/api/v1/*`** (the canonical, versioned
base) and **`/api/*`** (a backward-compatible alias to the current version). The
tables below use the shorter `/api/*` form — prefer `/api/v1/*` in new clients.

| Resource | Base path | Operations |
| --- | --- | --- |
| Fish | `/api/fish` | list, get `:id` (includes biting preference), get `by-name/:name`, create, update `:id`, delete `:id` |
| Locations | `/api/locations` | list, get `:id`, get `by-name/:name`, create, update `:id`, delete `:id` |
| Biting preferences | `/api/biting-preferences` | list, get `:fishId`, create, update `:fishId`, delete `:fishId` |
| Fish ↔ Location | `/api/fish-locations` | list (filter `?fishId=&locationId=`), create, update / delete via `?fishId=&locationId=&specificSpot=` |
| Tackle catalog | `/api/baits`, `/api/boilies`, `/api/lure-types`, `/api/lures`, `/api/hooks`, `/api/jigheads`, `/api/sinkers`, `/api/keepnets`, `/api/addons` | list, get `:id`, create, update `:id`, delete `:id` (each — uniform id-in-path CRUD) |
| Geo spots | `/api/spots` | list, get `:id`, create, update `:id`, delete `:id` |
| Weather | `/api/weathers` | list, get `:id`, create, update `:id`, delete `:id` |

The `fish_locations` join has a composite key `(fishId, locationId, specificSpot)`, so update and delete take those three as query params rather than a path id.

### Wiki API

A second, **read-only** dataset scraped from the [Fishing Planet
Wiki](https://wiki.fishingplanet.com) (see [Wiki dataset](#wiki-dataset)) is
served under `/api/wiki`, kept separate from the FP-Collective resources above.
Each category exposes a **list** (`GET /api/wiki/<category>`) and a **by-slug
detail** (`GET /api/wiki/<category>/:slug`, `404` if unknown) — there are no
writes, since the tables are populated only by `wiki:load`. Note that detail is
keyed by `slug`, not a numeric id.

| Group | Categories |
| --- | --- |
| Species | `species` |
| Gear | `reels`, `rods`, `lines`, `hooks`, `sinkers`, `bobbers`, `lures` |
| Consumables | `baits`, `boilies`, `groundbaits` |
| Other kit | `equipment`, `transport`, `other`, `rigs` |
| Reference | `brands`, `technologies` |

The list endpoints share the pagination, filtering, and sorting conventions
below: each filters on `?q=` (name substring) plus category-specific params
(`subtype`, `kind`, `family`, `category`) and sorts on `id`/`name`.

**Cross-category search** — `GET /api/wiki/search?q=<term>` fans the name match
out across every category and returns one flat, category-tagged list, each hit
carrying the `slug` to reach its detail route. Narrow it with `?category=`
(comma-separated). A true cross-category count would mean a full scan per
category, so the response reports `hasMore` instead of a `total`:

```json
{
  "query": "carp", "limit": 50, "offset": 0, "hasMore": false,
  "results": [ { "category": "species", "name": "Common Carp", "slug": "common-carp" } ]
}
```

### Pagination

Every `list` endpoint is paginated via `?limit=` (default `50`, max `100`) and
`?offset=` (default `0`), and returns an envelope rather than a bare array:

```json
{ "data": [ /* rows */ ], "total": 277, "limit": 50, "offset": 0 }
```

`total` is the full count for the query (ignoring `limit`/`offset`), so a client
can page until `offset + limit >= total`. An out-of-range `limit`/`offset` (or a
non-integer value) returns `400`.

### Filtering

`list` endpoints accept a whitelist of filter query params (combined with `AND`,
and reflected in `total`). Unknown params are ignored. `?q=` is a
case-insensitive substring match; the rest are exact. A malformed boolean/integer
filter returns `400`.

| Endpoint | Filters |
| --- | --- |
| `/api/fish` | `q` (name), `family`, `isMonster`, `isEventFish` |
| `/api/locations` | `q` (name), `region`, `waterwayType`, `unlockLevel` |
| `/api/biting-preferences` | `depthZone` |
| `/api/fish-locations` | `fishId`, `locationId` |

Example: `GET /api/fish?q=bass&isMonster=true&limit=10`.

The tackle catalog, `spots`/`weathers`, and `/api/wiki/*` list endpoints each add
their own filter whitelist (always at least `q`); the exact params per endpoint
are in [`/docs`](https://fishing-planet-api.vercel.app/docs) and `openapi.yaml`.

### Sorting

`list` endpoints accept `?sort=<field>&order=asc|desc` (`order` defaults to
`asc`). Without `sort`, each endpoint keeps its default order. `sort` must name a
whitelisted column, and `order` must be `asc`/`desc`, else `400`.

| Endpoint | Sortable fields | Default |
| --- | --- | --- |
| `/api/fish` | `id`, `commonName`, `family`, `creditsPerKgUnique`, `monsterTargetWeight` | `id` asc |
| `/api/locations` | `id`, `name`, `region`, `waterwayType`, `unlockLevel` | `id` asc |
| `/api/biting-preferences` | `fishId`, `depthZone` | `fishId` asc |
| `/api/fish-locations` | `fishId`, `locationId`, `specificSpot` | `fishId`, `locationId` asc |

Example: `GET /api/fish?sort=commonName&order=desc`.

Likewise, the tackle catalog, `spots`/`weathers`, and `/api/wiki/*` list endpoints
each declare their own sortable columns (see [`/docs`](https://fishing-planet-api.vercel.app/docs)).

### Auth

Write operations (`POST`/`PATCH`/`DELETE` on `/api`) require an API key sent as
`Authorization: Bearer <key>`; reads (list, get, by-name) are public. A missing or
invalid key returns `401`. Valid keys are the comma-separated **`API_KEYS`** env
var — when it's empty, auth is **disabled** (writes open), so set it in any real
deployment. The Compose stack sets `local-dev-key` by default. `/health`,
`/ready`, and `/docs` are always public.

### Graceful shutdown

On `SIGTERM`/`SIGINT` the server stops accepting connections, lets in-flight
requests finish, closes the Prisma pool, then exits `0` — logging `shutdown
initiated`/`shutdown complete`. A backstop (`SHUTDOWN_TIMEOUT_MS`, default `10s`)
forces exit if draining stalls. The Compose stack sets `stop_grace_period: 15s`
so Docker gives that drain room before escalating to `SIGKILL`.

### Logging

The server emits **structured JSON logs** (one line per request and per error) to
stdout — `{ level, time, msg, method, path, status, durationMs, requestId }`. Each
response carries an `X-Request-Id` header (a generated UUID, or the client's if it
sends one) that appears as `requestId` in the logs for correlation. Liveness/
readiness probes aren't logged. `LOG_SILENT=1` silences output (used by the test
suite).

### Metrics

`GET /metrics` exposes Prometheus metrics: `http_requests_total` and
`http_request_duration_seconds` (labeled by `method`, the matched **route
pattern** — e.g. `/api/fish/:id` — and `status`), plus default Node
process/runtime metrics (heap, GC, event-loop lag, CPU). It's public and outside
`/api` (no auth or rate limit), so restrict it at the network layer in
production. Probes and the scrape itself aren't counted.

### Rate limiting

All `/api/*` endpoints are rate limited per client IP — by default **100 requests
per 60s**. Every response carries `RateLimit-Limit`, `RateLimit-Remaining`, and
`RateLimit-Reset`; over the limit returns `429` with a `Retry-After` header. Tune
with `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` (`RATE_LIMIT_MAX=0` disables it).
`/health`, `/ready`, and `/docs` are exempt. Counters are in-memory per instance,
so each replica limits independently (use a shared store to limit across a
horizontally-scaled fleet).

### Caching

Successful `GET` reads under `/api/*` are tagged `Cache-Control: public,
max-age=0, s-maxage=3600, stale-while-revalidate=86400`, so a shared/CDN cache
(e.g. Vercel's edge) serves them for up to an hour and refreshes in the
background for a day — the data is static game data that only changes on a
reseed. Only `200` reads are tagged: writes and error responses are never
cached, and the meta endpoints (`/health`, `/ready`, `/metrics`) sit outside
`/api`, so they're exempt. On a cache hit the function isn't invoked, so cached
reads also bypass the rate limiter. After an out-of-band reseed, redeploy (or
wait out the TTL) to refresh the edge cache.

## API specification

The full API — every endpoint, query param, request/response schema, and error
status — is described in [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0). Load it
into Swagger Editor, Postman, or a client generator. It's hand-maintained, so
keep it in sync when routes change; lint it with:

```bash
npx @redocly/cli lint openapi.yaml
```

The running server also serves interactive docs: **Swagger UI at `/docs`** (assets
loaded from a CDN) and the raw spec at `/openapi.yaml`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, coding conventions, and the pull request flow.

## License

[MIT](LICENSE) © Josh Meyer
