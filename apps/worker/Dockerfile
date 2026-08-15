# syntax=docker/dockerfile:1

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

FROM node:20-slim AS runner
WORKDIR /repo
RUN corepack enable
ENV NODE_ENV=production
COPY --from=deps /repo ./
COPY . .
CMD ["pnpm", "--filter", "@filecloud/worker", "start"]
