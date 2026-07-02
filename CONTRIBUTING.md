# Contributing

Thanks for helping improve fishing-planet-api. This guide covers local setup,
the conventions the codebase relies on, and how changes get merged.

## Prerequisites

- Node.js 20+ (CI runs on 22)
- [pnpm](https://pnpm.io)
- A PostgreSQL database

## Setup

```bash
pnpm install                # runs prisma generate via postinstall
cp .env.example .env        # then set DATABASE_URL
pnpm db:push                # create tables from the Prisma schema
pnpm seed                   # (optional) load data/locations/*.md
pnpm seed:biting            # (optional) load data/fish/*.md
pnpm dev                    # hot-reload dev server on PORT (default 8080)
```

## Before you open a PR

Both checks are enforced by CI and must pass before a pull request can merge:

```bash
pnpm typecheck              # tsc --noEmit
pnpm test                   # Vitest suite
```

There is no linter configured — `pnpm typecheck` is the only static check. Add or
update tests under `tests/` for any behavior you change; route tests mock
`src/db.js`, so they need no database.

## Conventions

These are load-bearing; see `CLAUDE.md` for the full rationale.

- **ESM imports** — relative imports must carry a `.js` extension even from `.ts`
  sources (e.g. `import { app } from './app.js'`). Use `import type` for
  type-only imports.
- **Prisma client** — import types and the client from
  `../generated/prisma/client.js`, not from `@prisma/client`. Regenerate with
  `pnpm db:generate` after any schema change, before typechecking.
- **Routes** — each resource follows the same CRUD shape and shares `pick()` and
  `isNotFound()` from `src/routes/helpers.ts`. Whitelist request fields via each
  route's `FIELDS` tuple rather than passing the body through.
- **Surgical changes** — touch only what your change requires; match the
  surrounding style and don't refactor unrelated code.

## Branch and PR flow

`main` is protected: changes land through a pull request with a passing `test`
check.

1. Branch off `main` (`git switch -c my-change`).
2. Commit focused changes with a clear message.
3. Push and open a PR against `main`; the pull request template will prompt for a
   summary, notable changes, and a checklist.
4. Once CI is green, the PR can be merged.
