# syntax=docker/dockerfile:1
#
# Production image for @repo/admin (Next.js standalone output, back office).
# Build from the repository root (the context must contain the whole monorepo):
#
#   docker build -f apps/admin/Dockerfile \
#     --build-arg API_INTERNAL_URL=http://server:4000 \
#     -t app-admin .
#
# API_INTERNAL_URL is baked into the rewrites (/api/auth/*, /trpc/*) at build time, so it must
# point to the API as seen from this container. Sentry source maps are uploaded only when the
# optional secret is provided: --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN

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
    NEXT_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1 \
    HUSKY=0 \
    CI=1
RUN npm install --global "pnpm@${PNPM_VERSION}" && npm cache clean --force
WORKDIR /app

# ---------------------------------------------------------------------------------------------
# pruner: keeps only @repo/admin and the workspaces it depends on.
# ---------------------------------------------------------------------------------------------
FROM base AS pruner
ARG TURBO_VERSION
RUN npm install --global "turbo@${TURBO_VERSION}" && npm cache clean --force
COPY . .
RUN turbo prune @repo/admin --docker

# ---------------------------------------------------------------------------------------------
# installer: install + `next build` (output: "standalone", traced from the repo root).
# SKIP_ENV_VALIDATION=1 skips the build-time env validation (runtime variables are still
# validated on first use). `--env-mode=loose` lets the build see every variable set here.
# ---------------------------------------------------------------------------------------------
FROM base AS installer
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir "${PNPM_STORE_DIR}"
COPY --from=pruner /app/out/full/ ./

ARG API_INTERNAL_URL=http://server:4000
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV NODE_ENV=production \
    SKIP_ENV_VALIDATION=1 \
    API_INTERNAL_URL=${API_INTERNAL_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    SENTRY_ORG=${SENTRY_ORG} \
    SENTRY_PROJECT=${SENTRY_PROJECT}

# `public/` is optional in the app; create it so the runner COPY never fails.
RUN mkdir -p apps/admin/public
RUN --mount=type=secret,id=sentry_auth_token,required=false \
    if [ -s /run/secrets/sentry_auth_token ]; then \
      SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; export SENTRY_AUTH_TOKEN; \
    fi; \
    pnpm turbo run build --filter=@repo/admin --env-mode=loose

# ---------------------------------------------------------------------------------------------
# runner: only the traced standalone server + static assets, non-root user.
# The standalone tree mirrors the monorepo (apps/admin/server.js), so static files and public/
# go to apps/admin/ as well.
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
# npm/npx/corepack are not needed at runtime: removing them shrinks the attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
# Owned by `node`: Next writes its runtime cache under apps/admin/.next/cache.
COPY --from=installer --chown=node:node /app/apps/admin/.next/standalone ./
COPY --from=installer --chown=node:node /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=installer --chown=node:node /app/apps/admin/public ./apps/admin/public
USER node
EXPOSE 3001
# /sign-in is public (not behind the auth proxy) and renders without calling the API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/sign-in').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
STOPSIGNAL SIGTERM
CMD ["node", "apps/admin/server.js"]
