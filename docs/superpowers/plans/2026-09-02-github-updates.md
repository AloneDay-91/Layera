# GitHub Release Update Notices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; user asked to start immediately). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins see a dismissable Kumo banner when a newer GitHub Release exists, with a link and a Docker compose command to copy.

**Architecture:** `APP_VERSION` is baked into the web image. `GET /api/admin/updates` compares it to `releases/latest` (1h cache). The dashboard shell mounts `UpdateBanner` for admins only. Prod `web` pulls GHCR instead of building locally. Tagging `vX.Y.Z` publishes the image and a GitHub Release.

**Tech Stack:** Next.js 15 route handler, Vitest, Kumo Banner, GitHub Releases API, GHCR, docker-compose.prod.yml.

## Global Constraints

- Admins only (`role === "admin"`); non-admins get 404 on the API and no banner.
- No Docker socket; no in-app deploy.
- `0.0.0-dev` never notifies.
- GitHub failures fail closed (`upToDate: true`).
- Sentence-case copy; Kumo Banner `variant="default"` (info tint — Kumo has no `info` variant).
- Default repo `AloneDay-91/filecloud-v2`.
- Compose command: `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.

---

### Task 1: Version helpers (TDD)

**Files:**
- Create: `apps/web/lib/app-version.ts`
- Create: `apps/web/lib/updates.ts`
- Create: `apps/web/lib/updates.test.ts`

- [ ] Failing tests then `normalizeVersion`, `isDevVersion`, `isUpdateAvailable`, `toUpdatesResponse`, `getAppVersion`.
- [ ] `pnpm --filter @filecloud/web test -- lib/updates.test.ts`

### Task 2: Admin updates API

**Files:**
- Create: `apps/web/app/api/admin/updates/route.ts`
- Modify: `apps/web/lib/updates.ts` (GitHub fetch + 1h cache, injectable `fetch`)

- [ ] Tests for fail-closed fetch and cache.
- [ ] Route: `getAdminSession()` → 404; else JSON from `toUpdatesResponse`.

### Task 3: Banner UI

**Files:**
- Create: `apps/web/components/shell/update-banner.tsx`
- Modify: `apps/web/components/shell/dashboard-shell.tsx`
- Modify: `apps/web/messages/en.json`, `apps/web/messages/fr.json`

- [ ] Banner under header if admin; dismiss in `localStorage` key `filecloud-dismissed-update`.

### Task 4: Docker / CI / docs

**Files:**
- Modify: `apps/web/Dockerfile`, `docker-compose.prod.yml`, `.github/workflows/docker-publish.yml`
- Modify: `README.md`, `.env.example`, `.env.production.example`

- [ ] `ARG/ENV APP_VERSION`; prod `web` uses GHCR image; tag `v*.*.*` publishes image + GitHub Release.
