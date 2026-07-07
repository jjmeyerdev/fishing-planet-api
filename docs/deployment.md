# Deployment

The API is deployed to [Vercel](https://vercel.com) as a single Node serverless
function that wraps the same Hono `app` used locally and in Docker.

- **Live:** <https://fishing-planet-api.vercel.app> (Swagger UI at `/docs`)
- **Runtime:** Node.js serverless — not Edge, since `pg` and the Prisma
  `@prisma/adapter-pg` driver adapter require Node.

## How it works

`api/index.ts` is the only serverless function. It wraps the Hono app and lets the
app do its own routing:

```ts
import { handle } from '@hono/node-server/vercel'
import { app } from '../src/app.js'

export default handle(app)
```

`vercel.json` configures the project as an API-only deployment:

- `framework: null` — without this, Vercel auto-detects "Hono" and tries to run
  `src/app.ts` itself as a function (`Invalid export … must be a function`).
- `rewrites: /(.*) → /api` — every path (`/health`, `/ready`, `/docs`, `/metrics`,
  `/api/*`) is routed to the one function, which does its own routing.
- `buildCommand: prisma generate` + `outputDirectory: public` (an empty
  `public/.gitkeep`) — there is no `tsc`/static build; `@vercel/node` bundles the
  function and its `src/**` + generated-client imports itself. `postinstall` also
  runs `prisma generate` during install.
- `functions."api/index.ts".includeFiles: openapi.yaml` — bundles the OpenAPI spec
  so `/openapi.yaml` and `/docs` resolve (they read it relative to the module).

`src/index.ts` (the `@hono/node-server` listener with graceful shutdown) is **not**
used on Vercel; it still runs the container and local (`pnpm dev` / `pnpm start`)
servers.

### Two non-obvious gotchas

- **Use the Node adapter, not the Edge one.** `@hono/node-server/vercel`'s `handle`
  bridges Vercel's Node `(req, res)` signature to Hono. `hono/vercel`'s `handle` is
  for the Edge runtime; on Node it hands Hono a request whose headers are a plain
  object, so every request throws `this.raw.headers.get is not a function`.
- **Disable the framework preset.** `framework: null` stops Vercel's auto-detected
  Hono preset from fighting the explicit `api/` function and rewrite.

## Environment variables

Set these in the Vercel project (Settings → Environment Variables), not in `.env`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string (the `-pooler` host), `?sslmode=require` |
| `API_KEYS` | Comma-separated keys — set so writes require `Authorization: Bearer <key>`; reads stay public |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Optional; default 100 requests / 60s |

Use the **pooled** URL for the serverless runtime (many short-lived function
instances). Keep the **direct** (non-pooled) URL for migrations.

## Git integration

The GitHub repo is connected to the Vercel project:

- Push to `main` → **production** deploy (aliased to the production domain).
- Every pull request → a **preview** deploy with its own URL.

## Migrations

Migrations do **not** run on deploy. Apply schema changes out-of-band before
shipping the code that depends on them:

```bash
DATABASE_URL='<direct, non-pooled Neon URL>' pnpm prisma migrate deploy
```

Use the **direct** URL — `prisma migrate` does not work through the transaction
pooler.

## Manual deploy and inspection

The [Vercel CLI](https://vercel.com/docs/cli) drives one-off deploys and debugging:

```bash
vercel deploy --prod                  # deploy the current working tree to production
vercel ls fishing-planet-api          # recent deployments and their status
vercel logs <deployment-url> --json   # runtime logs
```

## Verification

After a deploy, check the key endpoints (all should return `200`):

```bash
node -e "(async()=>{for(const p of ['/health','/ready','/api/spots?limit=1','/openapi.yaml']){const r=await fetch('https://fishing-planet-api.vercel.app'+p);console.log(p,r.status)}})()"
```

`/ready` confirms the database is reachable, `/api/*` confirms Prisma queries run,
and `/openapi.yaml` confirms the spec bundled.

## Serverless caveats

- The **in-memory rate limiter** is per-instance and resets on cold starts, so it
  is best-effort rather than a global limit. A shared store (e.g. Upstash / Vercel
  KV) would be needed for a true cross-instance limit.
- **`/metrics`** (Prometheus) is per-instance and ephemeral, so it is not
  meaningfully scrapeable on serverless.
