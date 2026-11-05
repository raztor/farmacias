# syntax=docker/dockerfile:1
#
# Production image for @repo/worker (BullMQ consumers: emails).
# Build from the repository root (the context must contain the whole monorepo):
#
#   docker build -f apps/worker/Dockerfile -t app-worker .
#
# Stages: base -> pruner (turbo prune) -> installer (install + build) -> prod-deps -> runner.

ARG NODE_IMAGE=node:26.13-alpine
ARG PNPM_VERSION=12.16.1
ARG TURBO_VERSION=2.11.10

# ---------------------------------------------------------------------------------------------
# base: Node + pnpm (Node 26 images no longer ship Corepack, so pnpm is installed with npm).
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_STORE_DIR=/pnpm/store \
    TURBO_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1 \
    HUSKY=0 \
    CI=1
RUN npm install --global "pnpm@${PNPM_VERSION}" && npm cache clean --force
WORKDIR /app

# ---------------------------------------------------------------------------------------------
# pruner: keeps only @repo/worker and the workspaces it depends on.
#   out/json -> package.json files + pruned lockfile (dependency layer, cache friendly)
#   out/full -> source of those workspaces (+ pnpm-workspace.yaml with the catalog, turbo.json)
# ---------------------------------------------------------------------------------------------
FROM base AS pruner
ARG TURBO_VERSION
RUN npm install --global "turbo@${TURBO_VERSION}" && npm cache clean --force
COPY . .
RUN turbo prune @repo/worker --docker

# ---------------------------------------------------------------------------------------------
# installer: full install (dev deps included) and build. `build` depends on `db:generate`
# (turbo.json), so the Prisma client is generated from the schema before tsup bundles it.
# ---------------------------------------------------------------------------------------------
FROM base AS installer
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir "${PNPM_STORE_DIR}"
COPY --from=pruner /app/out/full/ ./
RUN pnpm turbo run build --filter=@repo/worker

# ---------------------------------------------------------------------------------------------
# prod-deps: production dependencies only, keeping the pruned workspace layout.
#
# The tsup bundle rewrites the third-party imports of workspace packages to
# `../../../packages/<pkg>/node_modules/<dep>` (see apps/worker/tsup.config.ts), so the runtime
# needs `apps/worker` + `packages/*/node_modules` side by side. `pnpm deploy` flattens the
# project into a single directory and would break those paths, hence `install --prod`.
# `--no-optional`: same flags as apps/server/Dockerfile. Optional peers resolved against the
# workspace (next, react, vitest...) are skipped; nothing the bundle loads at runtime is optional.
# `--ignore-scripts`: no build scripts are needed at runtime (BullMQ's msgpackr-extract is an
# optional native speed-up) and it also skips the root `prepare` (husky, a dev dep).
# ---------------------------------------------------------------------------------------------
FROM base AS prod-deps
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --no-optional --ignore-scripts --store-dir "${PNPM_STORE_DIR}"

# ---------------------------------------------------------------------------------------------
# runner: minimal runtime, non-root user, no package managers.
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    WORKER_HEALTH_PORT=4100
# npm/npx/corepack are not needed at runtime: removing them shrinks the attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
# Files stay owned by root (read-only for the app user).
COPY --from=prod-deps /app ./
COPY --from=installer /app/apps/worker/dist ./apps/worker/dist
WORKDIR /app/apps/worker
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.WORKER_HEALTH_PORT || 4100) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# On SIGTERM the worker stops taking jobs, waits for running ones (20 s drain, 27 s hard limit)
# and closes SMTP/Redis.
STOPSIGNAL SIGTERM
CMD ["node", "--import", "./dist/instrument.js", "dist/index.js"]
