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

# --- Runner: production dependencies + compiled output only ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# --ignore-scripts skips the prisma-generate postinstall: the client is already
# compiled into dist/, and the prisma CLI isn't a production dependency.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
