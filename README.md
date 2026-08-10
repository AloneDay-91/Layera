# FileCloud

Self-hosted file manager. See `CLAUDE.md` for the full product plan and
`docs/superpowers/specs/` for sub-project specs.

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
