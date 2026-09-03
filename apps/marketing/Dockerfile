# syntax=docker/dockerfile:1

FROM node:20-slim AS deps
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/marketing/package.json apps/marketing/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM node:20-slim AS builder
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo ./
COPY . .
RUN pnpm --filter @filecloud/marketing build

FROM node:20-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /repo/apps/marketing/public ./apps/marketing/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/marketing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/marketing/.next/static ./apps/marketing/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/marketing/server.js"]
