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

## Structure

```text
data/
  locations/         FP-Collective place pages (markdown) — source for pnpm seed
  fish/              FP-Collective per-fish pages (markdown) — source for pnpm seed:biting
prisma/
  schema.prisma      models: Fish, Location, FishLocation, BitingPreference
prisma.config.ts     Prisma CLI config (schema path, migrations, datasource url)
scripts/
  seed.ts            parse data/locations/*.md → upsert locations/fish/fish-locations
  seed-biting-preferences.ts  parse data/fish/*.md → upsert biting_preferences
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

Base: `GET /` (info), `GET /health` (liveness — process is up), `GET /ready`
(readiness — pings the DB; `503` when unreachable). A DB connection failure
during any request returns `503`, not `500`.

| Resource | Base path | Operations |
| --- | --- | --- |
| Fish | `/api/fish` | list, get `:id` (includes biting preference), get `by-name/:name`, create, update `:id`, delete `:id` |
| Locations | `/api/locations` | list, get `:id`, get `by-name/:name`, create, update `:id`, delete `:id` |
| Biting preferences | `/api/biting-preferences` | list, get `:fishId`, create, update `:fishId`, delete `:fishId` |
| Fish ↔ Location | `/api/fish-locations` | list (filter `?fishId=&locationId=`), create, update / delete via `?fishId=&locationId=&specificSpot=` |

The `fish_locations` join has a composite key `(fishId, locationId, specificSpot)`, so update and delete take those three as query params rather than a path id.

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
