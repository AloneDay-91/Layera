<div align="center">

<img src="apps/web/public/logo.svg" alt="Layera" width="120" />

# Layera

**A self-hosted file manager for developers and small teams.**

[![CI](https://github.com/AloneDay-91/filecloud-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/AloneDay-91/filecloud-v2/actions/workflows/ci.yml)
[![Docker image](https://github.com/AloneDay-91/filecloud-v2/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/AloneDay-91/filecloud-v2/actions/workflows/docker-publish.yml)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)

</div>

---

Layera pairs a fast, polished UI ([Kumo](https://kumo-ui.com), Cloudflare's
design system) with S3-compatible object storage (MinIO). Postgres is the
source of truth for the file tree, permissions, and metadata; MinIO only
ever stores bytes. See [`CLAUDE.md`](CLAUDE.md) for the full product plan
and [`docs/superpowers/specs/`](docs/superpowers/specs/) for sub-project
specs.

## Features

- **Auth** — email/password, email OTP, TOTP two-factor with backup codes,
  GitHub/Google social login, multi-session account switching
- **Workspaces** — a personal space per user plus team/organization
  workspaces, each fully isolated (files, tags, shares, storage stats)
- **Files & folders** — create, rename, move (drag-and-drop), trash with
  restore, multi-select bulk delete, folder color customization
- **Upload** — multi-file upload with progress (presigned MinIO PUT, UUID object keys)
- **Worker** — image thumbnails, trash purge, expired upload cleanup
- **Views** — sortable/filterable table and grid views, URL-driven
  pagination, favorites, recents
- **Tags** — workspace-wide colored tags, assignable to any file or folder
- **Previews** — images, PDF, video/audio (with HTTP range seeking),
  Markdown (sanitized), and syntax-highlighted code
- **Sharing** — public links with optional password and expiration
- **Admin** — instance settings (registration, sharing, teams, favorites,
  tags, archive, quotas), staff roles (admin / moderator / support),
  user/workspace panel, in-app update banner from GitHub Releases

## Tech stack

| Layer      | Choice                                                  |
| ---------- | -------------------------------------------------------- |
| Framework  | Next.js 15 (App Router), React 19, TypeScript             |
| UI         | [Kumo](https://kumo-ui.com) + Tailwind CSS                |
| Auth       | [Better Auth](https://better-auth.com) (email/OTP/2FA, social, orgs) |
| Database   | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)       |
| Storage    | MinIO (S3-compatible)                                      |
| Monorepo   | pnpm workspaces                                             |
| CI/CD      | GitHub Actions                                              |

## Project structure

```
layera/
├── apps/
│   ├── web/          # Next.js app
│   └── worker/       # Thumbnails, trash purge, expired upload cleanup
├── packages/
│   ├── db/           # Drizzle schema, client, migrations
│   ├── storage/      # MinIO client + helpers
│   ├── config/        # Shared ESLint/TypeScript config
│   └── types/          # Shared domain types
├── docker-compose.yml       # Local dev stack
├── docker-compose.prod.yml  # Production stack
└── .github/workflows/       # CI, Docker publish, dependency audit
```

## Local development

1. `cp .env.example .env` and fill in `BETTER_AUTH_SECRET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
   Put your email in `ADMIN_EMAILS` so the first login is promoted to admin.
2. `cp .env apps/web/.env`, then edit `apps/web/.env` so `DATABASE_URL` uses `localhost` instead of
   `postgres` as the host (the `postgres` hostname only resolves inside the Docker network). Also
   set `S3_ENDPOINT=localhost` and `S3_PORT=9010` there — Compose publishes MinIO on `9010`.
3. `pnpm install`
4. `docker compose up -d postgres minio`
5. Create the `filecloud` bucket in the MinIO console at `http://localhost:9011`.
6. `export $(grep -v '^#' apps/web/.env | xargs)`
7. `pnpm db:migrate`
8. `pnpm dev` — app runs at `http://localhost:3000`.
9. `pnpm dev:worker` — thumbnails and deferred deletion (optional in local `pnpm dev`; included in Docker Compose).

Or run everything in Docker: `docker compose up --build`. The `web` service runs on
`http://localhost:3000`, the worker processes jobs, Postgres on `localhost:5432`, the MinIO S3 API on
`http://localhost:9010`, and the MinIO console on `http://localhost:9011`.

### Environment variables

Copy [`.env.example`](.env.example) for local Compose / `pnpm dev`, and
[`.env.production.example`](.env.production.example) for production.
`NODE_ENV`, `PORT`, `HOSTNAME`, and `APP_VERSION` are set by Next.js or
the Docker image — you do not need them in `.env`.

#### Core (required)

| Variable | Notes |
| -------- | ----- |
| `DATABASE_URL` | Postgres connection string. Host `postgres` inside Compose; `localhost` for `pnpm dev`. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. Also signs public-share unlock cookies. |
| `BETTER_AUTH_URL` | Public origin Better Auth issues cookies for. |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Optional, and only honoured at build time — `NEXT_PUBLIC_*` is inlined into the browser bundle. Leave it unset so the browser calls the origin it loaded the page from. |

#### Object storage (required)

| Variable | Notes |
| -------- | ----- |
| `S3_ENDPOINT` | MinIO hostname (`minio` in Docker, `localhost` for `pnpm dev`). |
| `S3_PORT` | MinIO API port (`9000` in Docker, `9010` on the host). |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO root credentials. |
| `S3_BUCKET` | Bucket name (create it once in the MinIO console). |
| `S3_USE_SSL` | `true` if MinIO is reached over HTTPS. Default `false`. |
| `S3_PUBLIC_ENDPOINT` | Browser-facing MinIO URL for presigned PUT/GET (e.g. `http://localhost:9010`). Leave unset in production if MinIO is not reverse-proxied — uploads then go through `/api/uploads/[id]`. |

#### Quotas

These seed the instance defaults. Admins can change them later in
**Admin → Settings**.

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `MAX_UPLOAD_BYTES` | 5 GiB | Per-file upload cap. |
| `MAX_WORKSPACE_BYTES` | 10 GiB | Default workspace quota. |

#### Database pool

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `DATABASE_POOL_MAX` | `10` | `pg` pool size. |
| `DATABASE_SSL` | `false` | Set `true` for managed Postgres that requires TLS. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true` | Only used when `DATABASE_SSL=true`. Set `false` for a private CA. |

#### Auth and admin

| Variable | Required | Notes |
| -------- | :------: | ----- |
| `ADMIN_EMAILS` | bootstrap | Comma-separated emails promoted to `admin` on every login. This is the only way to create the first admin. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | – | Enables "Continue with GitHub". |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Enables "Continue with Google". |

#### Reverse proxy and cron

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `TRUST_PROXY` | `false` (`true` in production) | Trust `X-Forwarded-For` when the app sits behind nginx/Caddy. |
| `CRON_SECRET` | unset | Protects `POST /api/cron/purge-trash` (`Authorization: Bearer …`). The Compose worker already purges trash; set this only if you call the HTTP route instead. |

#### In-app updates

| Variable | Notes |
| -------- | ----- |
| `GITHUB_REPO` | Override `AloneDay-91/filecloud-v2` for the admin update banner. |
| `GITHUB_TOKEN` | Optional GitHub token to raise Releases API rate limits. |
| `APP_VERSION` | Stamped into the web image from the git tag (`v1.1.0` → `1.1.0`). Local fallback is `0.0.0-dev`. |

#### Production Compose only

Set these in `.env.production`. `DATABASE_URL` is built from the Postgres
trio — do not set it yourself.

| Variable | Notes |
| -------- | ----- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credentials for the Postgres container. |
| `LAYERA_VERSION` | GHCR web image tag (`v1.1.0`). Defaults to `latest`. |

#### Tooling (not needed to run the app)

| Variable | Notes |
| -------- | ----- |
| `ANTHROPIC_API_KEY` | Used only by `pnpm --filter @filecloud/web i18n:translate`. |

## Testing

`pnpm test` runs:

- workspace isolation (`packages/db`) — a stranger cannot join another personal workspace, and object keys never contain the display name
- storage key helpers (`packages/storage`) — UUID paths, no `..` traversal
- MIME sniffing, zip path safety, and i18n key shape (`apps/web`)

The database tests need Postgres running and `DATABASE_URL` pointing at `localhost`:

```bash
docker compose up -d postgres
export DATABASE_URL=postgresql://filecloud:filecloud@localhost:5432/filecloud
pnpm test
```

Every push/PR also runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` in CI.

## Production deployment

`apps/web/Dockerfile` builds a standalone Next.js production image
published to `ghcr.io/aloneday-91/filecloud-v2`. `docker-compose.prod.yml`
pulls that image for `web` and builds the worker locally, with a
deliberately locked-down network:

- **Postgres and MinIO publish no ports to the host at all** — only
  reachable from other containers on the compose network.
- **`web` binds to `127.0.0.1:3001`** — a different port than the dev
  stack's `3000`, and loopback-only. Point an HTTPS reverse proxy
  (nginx/Caddy) at it; the app itself is never internet-facing.
- **Presigned PUT/GET** are used when `S3_PUBLIC_ENDPOINT` is set and MinIO
  is reverse-proxied. Otherwise the app falls back to `/api/uploads/[id]`
  and `/api/files/content` so the bucket can stay private.

```bash
cp .env.production.example .env.production   # fill in secrets and ADMIN_EMAILS
docker login ghcr.io                         # if the package is private
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --build
```

`--build` compiles the worker on the host. `web` comes from GHCR (`latest`,
or pin `LAYERA_VERSION=v1.1.0` in the compose env).

### Releases and in-app updates

A green CI run on `main` cuts the next semver tag, creates a GitHub Release
whose notes list every change since the previous tag, and publishes
`ghcr.io/aloneday-91/filecloud-v2:vX.Y.Z` (and `latest`).
The bump comes from commit messages since the last tag:

| Commits since last tag | Bump |
| ---------------------- | ---- |
| `feat!:` or `BREAKING CHANGE` | major (`1.2.0` → `2.0.0`) |
| `feat:` | minor (`1.2.0` → `1.3.0`) |
| anything else (`fix:`, `docs:`, …) | patch (`1.2.0` → `1.2.1`) |

You can still publish an exact version by hand:

```bash
git tag v1.2.0
git push origin v1.2.0
```

Admins see a banner when a newer release exists. Update the running app:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Optional `GITHUB_TOKEN` in `.env.production` raises the GitHub API rate limit
used by the banner.

## Backups and restore

Postgres and MinIO use named Docker volumes (`postgres_data`, `minio_data`).
Keep them on separate schedules.

**Dump Postgres**

```bash
docker compose exec -T postgres pg_dump -U filecloud filecloud > backup-$(date +%F).sql
```

**Copy the MinIO volume** (objects only; the SQL dump is the source of truth
for names, tree, and permissions):

```bash
docker run --rm -v filecloud-v2_minio_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/minio-$(date +%F).tar.gz -C /data .
```

**Restore**

1. Stop the stack: `docker compose down`
2. Restore Postgres: `docker compose up -d postgres` then
   `docker compose exec -T postgres psql -U filecloud filecloud < backup-YYYY-MM-DD.sql`
3. Restore MinIO: extract the tarball back into the `minio_data` volume
4. `docker compose up -d`

Object keys are `workspaces/{workspaceId}/{uuid}` — never the original file
name — so a restored dump cannot be used to guess another tenant's objects.

## CI/CD

Three GitHub Actions workflows live under [`.github/workflows/`](.github/workflows/):

- **`ci.yml`** — lint, typecheck, and build on every push/PR to `main`,
  plus a `pnpm audit --audit-level=high` gate.
- **`docker-publish.yml`** — once CI is green on `main` (or on a manual
  `vX.Y.Z` tag): bumps semver, pushes the tag, creates the GitHub Release,
  stamps `APP_VERSION`, and publishes `ghcr.io/aloneday-91/filecloud-v2`.
- **`dependency-audit-fix.yml`** — weekly `pnpm audit --fix`, re-verified
  against lint/typecheck/build, opened as a PR for review (never pushed
  directly to `main`).
