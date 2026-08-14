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
- **Upload** — multi-file upload with progress, whole-page drag-and-drop
- **Views** — sortable/filterable table and grid views, URL-driven
  pagination, favorites, recents
- **Tags** — workspace-wide colored tags, assignable to any file or folder
- **Previews** — images, PDF, video/audio (with HTTP range seeking),
  Markdown (sanitized), and syntax-highlighted code
- **Sharing** — public links with optional password and expiration
- **Admin** — quota-aware storage dashboard, superadmin user/workspace panel

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
│   └── worker/       # Placeholder — thumbnails/async jobs, not wired up yet
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
2. `cp .env apps/web/.env`, then edit `apps/web/.env` so `DATABASE_URL` uses `localhost` instead of
   `postgres` as the host (the `postgres` hostname only resolves inside the Docker network).
3. `pnpm install`
4. `docker compose up -d postgres minio`
5. Create the `filecloud` bucket in the MinIO console at `http://localhost:9011`.
6. `export $(grep -v '^#' apps/web/.env | xargs)`
7. `pnpm db:migrate`
8. `pnpm dev` — app runs at `http://localhost:3000`.

Or run everything in Docker: `docker compose up --build`. The `web` service runs on
`http://localhost:3000`, Postgres on `localhost:5432`, the MinIO S3 API on
`http://localhost:9010`, and the MinIO console on `http://localhost:9011`.

### Environment variables

| Variable                        | Required | Notes                                                        |
| -------------------------------- | :------: | -------------------------------------------------------------- |
| `DATABASE_URL`                   |    ✅    | Postgres connection string                                     |
| `BETTER_AUTH_SECRET`             |    ✅    | `openssl rand -base64 32`                                        |
| `BETTER_AUTH_URL`                |    ✅    | Base URL Better Auth issues cookies for                          |
| `NEXT_PUBLIC_BETTER_AUTH_URL`    |    ✅    | Same URL, exposed to the browser                                 |
| `S3_ENDPOINT` / `S3_PORT`        |    ✅    | MinIO hostname/port (`minio` / `9000` inside Docker)             |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`|    ✅    | MinIO credentials                                                 |
| `S3_BUCKET`                      |    ✅    | Bucket name (create it once in the MinIO console)                 |
| `GITHUB_CLIENT_ID` / `_SECRET`   |    –     | Enables "Continue with GitHub"                                    |
| `GOOGLE_CLIENT_ID` / `_SECRET`   |    –     | Enables "Continue with Google"                                    |
| `ADMIN_EMAILS`                   |    –     | Comma-separated emails auto-promoted to the admin role on login   |

## Testing

The `@filecloud/db` package has an automated test that exercises workspace
provisioning against a real database. It requires Postgres running and
`DATABASE_URL` pointing at `localhost` (same pattern as the migration steps
above):

```bash
docker compose up -d postgres
export DATABASE_URL=postgresql://filecloud:filecloud@localhost:5432/filecloud
pnpm test
```

Every push/PR also runs `pnpm lint`, `pnpm typecheck`, and `pnpm build` in CI.

## Production deployment

`apps/web/Dockerfile` builds a standalone Next.js production image;
`docker-compose.prod.yml` runs it alongside Postgres and MinIO with a
deliberately locked-down network:

- **Postgres and MinIO publish no ports to the host at all** — only
  reachable from other containers on the compose network. The app proxies
  every file read/write through its own API routes, so nothing outside the
  `web` container ever needs to talk to MinIO directly.
- **`web` binds to `127.0.0.1:3001`** — a different port than the dev
  stack's `3000`, and loopback-only. Point an HTTPS reverse proxy
  (nginx/Caddy) at it; the app itself is never internet-facing.

```bash
cp .env.production.example .env.production   # fill in real secrets
docker compose -f docker-compose.prod.yml up -d --build
```

## CI/CD

Three GitHub Actions workflows live under [`.github/workflows/`](.github/workflows/):

- **`ci.yml`** — lint, typecheck, and build on every push/PR to `main`,
  plus a `pnpm audit --audit-level=high` gate.
- **`docker-publish.yml`** — once CI is green on `main`, builds the
  production image and pushes it to `ghcr.io/alonedday-91/filecloud-v2`.
- **`dependency-audit-fix.yml`** — weekly `pnpm audit --fix`, re-verified
  against lint/typecheck/build, opened as a PR for review (never pushed
  directly to `main`).
