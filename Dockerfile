# syntax=docker/dockerfile:1

# --- Builder: install all deps, generate the Prisma client, compile to dist/ ---
FROM node:22-slim AS builder
WORKDIR /app
# OpenSSL is needed by Prisma's engine build step on the slim image.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# pnpm-workspace.yaml carries the allowBuilds approvals (prisma/esbuild); without
# it pnpm aborts with ERR_PNPM_IGNORED_BUILDS. Schema is present so the
# postinstall `prisma generate` can run.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# Compile TypeScript (prisma generate + tsc) into dist/.
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# --- Runner: minimal Alpine image with production deps + compiled output ---
# No OpenSSL/engine here: the runtime talks to Postgres via the pg driver
# adapter and Prisma's wasm query compiler, not a native engine.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# --ignore-scripts skips the prisma-generate postinstall (client is already in
# dist/). auto-install-peers=false keeps the optional `prisma` CLI peer of
# @prisma/client out of the runtime — it drags in ~250MB of Studio/pglite/react
# the server never uses; the runtime needs only the pg driver adapter.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --ignore-scripts --config.auto-install-peers=false \
    # Drop packages left in the store that hang off the excluded prisma CLI peer
    # (Studio UI, pglite, effect, …). None are in the runtime graph rooted at the
    # prod deps; verified a live /api/fish round-trip still works without them.
    && rm -rf \
        node_modules/.pnpm/@prisma+studio-core@* \
        node_modules/.pnpm/@prisma+dev@* \
        node_modules/.pnpm/@prisma+config@* \
        node_modules/.pnpm/@prisma+query-plan-executor@* \
        node_modules/.pnpm/effect@* \
        node_modules/.pnpm/@electric-sql+* \
        node_modules/.pnpm/chart.js@* \
        node_modules/.pnpm/remeda@* \
        node_modules/.pnpm/react@* \
        node_modules/.pnpm/react-dom@* \
        node_modules/.pnpm/fast-check@*

COPY --from=builder /app/dist ./dist
# Served at /openapi.yaml (and rendered by Swagger UI at /docs); the runtime
# reads it from /app, next to dist/.
COPY openapi.yaml ./

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
