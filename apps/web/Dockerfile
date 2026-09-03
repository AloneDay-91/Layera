# syntax=docker/dockerfile:1

# ---- deps: install the full workspace's dependencies ----
FROM node:20-slim AS deps
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ---- builder: build the standalone Next.js output ----
FROM node:20-slim AS builder
WORKDIR /repo
RUN corepack enable
# pnpm symlinks each workspace member's own node_modules/.bin (e.g.
# apps/web/node_modules/.bin/next) in addition to the root one, so the
# whole deps-stage tree needs to come across, not just /repo/node_modules.
COPY --from=deps /repo ./
COPY . .
# next build collects route modules; the db client throws if DATABASE_URL is
# missing. These values are build-time only and are not copied into the runner.
# NEXT_PUBLIC_* is inlined at build time — pass the public origin as a build
# arg on Dokploy. When left empty, the client falls back to window.location.origin.
ARG BETTER_AUTH_URL=http://localhost:3000
ARG NEXT_PUBLIC_BETTER_AUTH_URL=
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_SECRET=build-placeholder-not-a-real-secret
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
ENV S3_ENDPOINT=minio
ENV S3_ACCESS_KEY=build-placeholder
ENV S3_SECRET_KEY=build-placeholder
ENV S3_BUCKET=filecloud
RUN pnpm --filter @filecloud/web build

# ---- runner: minimal production image ----
FROM node:20-slim AS runner
WORKDIR /repo
ARG APP_VERSION=0.0.0-dev
ENV NODE_ENV=production
ENV APP_VERSION=$APP_VERSION
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /repo/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
