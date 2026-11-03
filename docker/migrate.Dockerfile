# syntax=docker/dockerfile:1
#
# One-off job that applies the Prisma migrations of @repo/db (`prisma migrate deploy`).
# Run it BEFORE rolling out server/worker; the apps never migrate on startup.
# Build from the repository root:
#
#   docker build -f docker/migrate.Dockerfile -t app-migrate .
#   docker run --rm -e DATABASE_URL=postgresql://... app-migrate
#
# Only needs DATABASE_URL at runtime (read by packages/db/prisma.config.ts).

ARG NODE_IMAGE=node:26.13-alpine
ARG PNPM_VERSION=12.16.1
ARG TURBO_VERSION=2.11.10

# ---------------------------------------------------------------------------------------------
# base: Node + pnpm + OpenSSL (Prisma detects the OpenSSL version to pick its schema engine).
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_STORE_DIR=/pnpm/store \
    TURBO_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    DO_NOT_TRACK=1 \
    HUSKY=0 \
    CI=1
RUN apk add --no-cache openssl \
    && npm install --global "pnpm@${PNPM_VERSION}" && npm cache clean --force
WORKDIR /app

# ---------------------------------------------------------------------------------------------
# pruner: @repo/db (schema, migrations, prisma.config.ts) and the workspaces it needs.
# ---------------------------------------------------------------------------------------------
FROM base AS pruner
ARG TURBO_VERSION
RUN npm install --global "turbo@${TURBO_VERSION}" && npm cache clean --force
COPY . .
RUN turbo prune @repo/db --docker

# ---------------------------------------------------------------------------------------------
# deployer: `pnpm deploy` copies packages/db into a self-contained directory with its own
# node_modules. Dev dependencies are kept on purpose: the Prisma CLI and dotenv (used by
# prisma.config.ts) are dev dependencies of @repo/db. Build scripts run here because
# @prisma/engines downloads the schema engine for this platform (linux-musl) in postinstall.
# ---------------------------------------------------------------------------------------------
FROM base AS deployer
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/full/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm deploy --filter=@repo/db --store-dir "${PNPM_STORE_DIR}" /prod/db

# ---------------------------------------------------------------------------------------------
# runner: non-root, runs the pending migrations and exits (0 = success).
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
RUN apk add --no-cache openssl \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
       /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=deployer /prod/db ./
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
