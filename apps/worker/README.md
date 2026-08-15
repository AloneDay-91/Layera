# @filecloud/worker

Background worker for Layera. It consumes the `job` table:

- **thumbnail** — WebP 256×256 previews for raster images after upload
- **purge-trash** — permanently deletes items whose `purge_at` has passed
- **abort-uploads** — drops expired pending uploads and their MinIO objects

```bash
# with the same env as the web app (DATABASE_URL, S3_*)
pnpm --filter @filecloud/worker start
```

Docker Compose starts this service in both the local and production stacks.
