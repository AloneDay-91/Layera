# FileCloud — Fondations + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the FileCloud monorepo (pnpm + Next.js 15 + Drizzle + Better Auth + Docker/Postgres/MinIO) so a user can register, get a personal workspace auto-provisioned, log in, and reach a protected empty dashboard — with a `/design-system` page showcasing the Kumo component library.

**Architecture:** pnpm workspace monorepo. `apps/web` is the Next.js 15 App Router app (UI, API routes, Better Auth wiring). `packages/db` owns the Drizzle schema, client, migrations and the workspace-provisioning logic (pure DB layer, no HTTP). `packages/storage` holds a MinIO client stub (not consumed until the upload sub-project). `packages/types` holds shared domain types. `packages/config` holds shared TS/ESLint config. `apps/worker` is an empty placeholder package for the future async-jobs worker. Three Docker services (Postgres, MinIO, Next.js) run locally with named volumes.

**Tech Stack:** pnpm 10, Node 26 (Node 20+ required by Next 15), Next.js 15 (App Router, TypeScript), Tailwind CSS v4, Drizzle ORM + drizzle-kit + `pg`, Better Auth (email/password) with `better-auth/adapters/drizzle`, MinIO JS SDK, Kumo (`@cloudflare/kumo`) + `@phosphor-icons/react`, Vitest for automated tests, Docker Compose.

## Global Constraints

- Product name is **FileCloud**; package names are scoped `@filecloud/*`.
- No email verification for this sub-project — users can log in immediately after registering.
- `apps/worker` is created as an empty placeholder only (package.json + empty `src/index.ts` + README noting it is unused until the worker sub-project) — do not wire it into `pnpm dev` or Docker Compose.
- Environment variables (from the approved spec):
  ```env
  DATABASE_URL=postgresql://filecloud:filecloud@postgres:5432/filecloud
  BETTER_AUTH_SECRET=
  BETTER_AUTH_URL=http://localhost:3000
  S3_ENDPOINT=minio
  S3_PORT=9000
  S3_USE_SSL=false
  S3_ACCESS_KEY=
  S3_SECRET_KEY=
  S3_BUCKET=filecloud
  S3_PUBLIC_ENDPOINT=http://localhost:9000
  ```
- The database is the source of truth for the folder tree, permissions and metadata; MinIO stores only bytes (this only matters for `packages/storage`, which is posed but unused here).
- Unique constraint `(workspace_id, parent_id, name)` on `folder`, and `(workspace_id, folder_id, name)` on `file`.
- Full schema (`workspace`, `workspace_member`, `folder`, `file`, `share_link`, `upload`, `trash_item`, `audit_log`) is created now even though only `workspace`/`workspace_member`/`folder` (+ Better Auth tables) are exercised by this sub-project — this avoids a second migration in the next sub-project.
- Every `/dashboard/*` route is protected server-side; unauthenticated users are redirected to `/login`.

---

## File Structure

```
filecloud-v2/
├── package.json                        # workspace root scripts
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
├── docker-compose.yml
├── docker/postgres/                    # (empty, reserved for init scripts if ever needed)
├── apps/
│   ├── web/                            # Next.js 15 app (scaffolded via create-next-app)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── globals.css
│   │   │   ├── page.tsx
│   │   │   ├── design-system/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── dashboard/layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   └── api/auth/[...all]/route.ts
│   │   ├── lib/
│   │   │   ├── auth.ts                 # Better Auth server instance
│   │   │   └── auth-client.ts          # Better Auth React client
│   │   ├── middleware.ts               # optimistic cookie redirect for /dashboard
│   │   ├── package.json
│   │   └── (config files from create-next-app: tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs)
│   └── worker/                         # empty placeholder
│       ├── package.json
│       ├── src/index.ts
│       └── README.md
└── packages/
    ├── config/
    │   ├── package.json
    │   ├── tsconfig.base.json
    │   └── eslint.config.mjs
    ├── types/
    │   ├── package.json
    │   └── src/index.ts
    ├── db/
    │   ├── package.json
    │   ├── drizzle.config.ts
    │   ├── src/
    │   │   ├── schema/
    │   │   │   ├── auth.ts             # Better Auth tables (user, session, account, verification)
    │   │   │   ├── workspace.ts
    │   │   │   ├── folder.ts
    │   │   │   ├── file.ts
    │   │   │   ├── share-link.ts
    │   │   │   ├── upload.ts
    │   │   │   ├── trash-item.ts
    │   │   │   ├── audit-log.ts
    │   │   │   └── index.ts            # barrel
    │   │   ├── client.ts               # drizzle() instance + env validation
    │   │   ├── provisioning.ts         # provisionPersonalWorkspace()
    │   │   ├── provisioning.test.ts
    │   │   └── seed.ts
    │   └── migrations/                 # generated by drizzle-kit
    └── storage/
        ├── package.json
        └── src/
            ├── client.ts                # Minio.Client from env
            └── index.ts
```

---

### Task 1: Monorepo root scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/eslint.config.mjs`

**Interfaces:**
- Produces: root scripts `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm db:*` (wired to `@filecloud/web` and `@filecloud/db` filters in later tasks); `@filecloud/config` package exporting `tsconfig.base.json` (extended by every other package's `tsconfig.json`) and `eslint.config.mjs` (imported by every other package's ESLint config).

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "filecloud",
  "private": true,
  "packageManager": "pnpm@10.28.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "pnpm --filter @filecloud/web dev",
    "build": "pnpm --filter @filecloud/web build",
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test",
    "db:generate": "pnpm --filter @filecloud/db generate",
    "db:migrate": "pnpm --filter @filecloud/db migrate",
    "db:seed": "pnpm --filter @filecloud/db seed",
    "db:studio": "pnpm --filter @filecloud/db studio"
  }
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.next/
dist/
.env
.env.local
*.log
.turbo/
.DS_Store
```

- [ ] **Step 4: Create `.env.example`**

```env
DATABASE_URL=postgresql://filecloud:filecloud@postgres:5432/filecloud
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

S3_ENDPOINT=minio
S3_PORT=9000
S3_USE_SSL=false
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=filecloud
S3_PUBLIC_ENDPOINT=http://localhost:9000
```

- [ ] **Step 5: Create `packages/config/package.json`**

```json
{
  "name": "@filecloud/config",
  "version": "0.0.0",
  "private": true,
  "main": "tsconfig.base.json",
  "devDependencies": {
    "@eslint/js": "^9.18.0",
    "eslint": "^9.18.0",
    "typescript-eslint": "^8.20.0"
  }
}
```

- [ ] **Step 6: Create `packages/config/tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": false,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 7: Create `packages/config/eslint.config.mjs`**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
```

- [ ] **Step 8: Install root tooling and verify workspace resolves**

Run: `pnpm install`
Expected: completes without error (no packages depend on `@filecloud/config` yet, so this just installs root devDependencies — none yet — and creates `pnpm-lock.yaml`).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore .env.example packages/config pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo root and shared config package"
```

---

### Task 2: apps/web — Next.js 15 scaffold

**Files:**
- Create: `apps/web/` (via `create-next-app`, then modified)
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`

**Interfaces:**
- Consumes: `packages/config` (`tsconfig.base.json`).
- Produces: `pnpm dev` (run from root) starts `apps/web` on `http://localhost:3000`; `apps/web/app/layout.tsx` is the root layout every later page task edits.

- [ ] **Step 1: Scaffold Next.js app**

Run from repo root:
```bash
pnpm dlx create-next-app@latest apps/web \
  --ts --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-pnpm --no-git --turbopack
```
When prompted (only if `--yes`-style flags don't suppress it) accept defaults. If the CLI asks about the Next.js version, accept latest stable (15.x).

- [ ] **Step 2: Set the package name**

Edit `apps/web/package.json`, change:
```json
{
  "name": "@filecloud/web"
}
```

- [ ] **Step 3: Point `apps/web/tsconfig.json` at the shared base config**

Edit `apps/web/tsconfig.json` — replace the top-level compiler options with an `extends`, keeping the Next.js-specific ones `create-next-app` generated (`plugins`, `paths`, `include`, `exclude`):

```json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Add `@filecloud/config` as a dev dependency and add a `typecheck` script**

Edit `apps/web/package.json` scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@filecloud/config": "workspace:*"
  }
}
```
(Merge into the existing `devDependencies` object created by `create-next-app` — don't remove `typescript`, `@types/*`, etc.)

- [ ] **Step 5: Install and verify dev server boots**

Run: `pnpm install && pnpm dev`
Expected: `Next.js 15.x` banner, `Local: http://localhost:3000`, no compile errors. Visit `http://localhost:3000` — default Next.js starter page renders. Stop the server (Ctrl+C).

- [ ] **Step 6: Verify typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: scaffold apps/web with Next.js 15"
```

---

### Task 3: packages/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `@filecloud/types` exporting `WorkspaceRole` (`"owner" | "member"`) and `WorkspaceType` (`"personal" | "team"`) — consumed by `packages/db/src/schema/workspace.ts` (Task 4) and `packages/db/src/provisioning.ts` (Task 8).

- [ ] **Step 1: Create `packages/types/package.json`**

```json
{
  "name": "@filecloud/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@filecloud/config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `packages/types/tsconfig.json`**

```json
{
  "extends": "../config/tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/types/src/index.ts`**

```ts
export type WorkspaceRole = "owner" | "member";

export type WorkspaceType = "personal" | "team";

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = ["owner", "member"];

export const WORKSPACE_TYPES: readonly WorkspaceType[] = ["personal", "team"];
```

- [ ] **Step 4: Install and typecheck**

Run: `pnpm install && pnpm --filter @filecloud/types typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/types pnpm-lock.yaml
git commit -m "feat: add @filecloud/types shared domain types"
```

---

### Task 4: packages/db — schema, client, drizzle-kit config

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema/auth.ts`
- Create: `packages/db/src/schema/workspace.ts`
- Create: `packages/db/src/schema/folder.ts`
- Create: `packages/db/src/schema/file.ts`
- Create: `packages/db/src/schema/share-link.ts`
- Create: `packages/db/src/schema/upload.ts`
- Create: `packages/db/src/schema/trash-item.ts`
- Create: `packages/db/src/schema/audit-log.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/client.ts`

**Interfaces:**
- Consumes: `@filecloud/types` (`WorkspaceRole`, `WorkspaceType`).
- Produces: `@filecloud/db` exporting `db` (Drizzle client instance) and every table from `src/schema/index.ts` — `user`, `session`, `account`, `verification`, `workspace`, `workspaceMember`, `folder`, `file`, `shareLink`, `upload`, `trashItem`, `auditLog`. Consumed by `packages/db/src/provisioning.ts` (Task 8), `apps/web/lib/auth.ts` (Task 7), and `packages/db/src/seed.ts` (Task 5).

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@filecloud/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/client.ts",
  "types": "./src/client.ts",
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "studio": "drizzle-kit studio",
    "seed": "tsx src/seed.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@filecloud/types": "workspace:*",
    "drizzle-orm": "^0.38.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@filecloud/config": "workspace:*",
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../config/tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/db/src/schema/auth.ts` (Better Auth tables)**

```ts
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

- [ ] **Step 4: Create `packages/db/src/schema/workspace.ts`**

```ts
import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import type { WorkspaceRole, WorkspaceType } from "@filecloud/types";
import { user } from "./auth";

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").$type<WorkspaceType>().notNull().default("personal"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<WorkspaceRole>().notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("workspace_member_workspace_user_unique").on(table.workspaceId, table.userId)],
);
```

- [ ] **Step 5: Create `packages/db/src/schema/folder.ts`**

```ts
import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";

export const folder = pgTable(
  "folder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("folder_workspace_parent_name_unique").on(table.workspaceId, table.parentId, table.name),
  ],
);
```

- [ ] **Step 6: Create `packages/db/src/schema/file.ts`**

```ts
import { pgTable, text, timestamp, uuid, bigint, unique } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { folder } from "./folder";

export const file = pgTable(
  "file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => folder.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("file_workspace_folder_name_unique").on(table.workspaceId, table.folderId, table.name),
  ],
);
```

- [ ] **Step 7: Create `packages/db/src/schema/share-link.ts`**

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { file } from "./file";
import { folder } from "./folder";

export const shareLink = pgTable("share_link", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  fileId: uuid("file_id").references(() => file.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folder.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash"),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});
```

- [ ] **Step 8: Create `packages/db/src/schema/upload.ts`**

```ts
import { pgTable, text, timestamp, uuid, bigint } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { folder } from "./folder";
import { user } from "./auth";

export const upload = pgTable("upload", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id")
    .notNull()
    .references(() => folder.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  storageKey: text("storage_key").notNull().unique(),
  status: text("status").$type<"pending" | "completed" | "aborted">().notNull().default("pending"),
  checksum: text("checksum"),
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 9: Create `packages/db/src/schema/trash-item.ts`**

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { user } from "./auth";

export const trashItem = pgTable("trash_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  itemType: text("item_type").$type<"file" | "folder">().notNull(),
  itemId: uuid("item_id").notNull(),
  deletedBy: text("deleted_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
  purgeAt: timestamp("purge_at").notNull(),
});
```

- [ ] **Step 10: Create `packages/db/src/schema/audit-log.ts`**

```ts
import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { user } from "./auth";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 11: Create `packages/db/src/schema/index.ts`**

```ts
export * from "./auth";
export * from "./workspace";
export * from "./folder";
export * from "./file";
export * from "./share-link";
export * from "./upload";
export * from "./trash-item";
export * from "./audit-log";
```

- [ ] **Step 12: Create `packages/db/src/client.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: databaseUrl });

export const db = drizzle(pool, { schema });
export * from "./schema";
```

- [ ] **Step 13: Create `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
```

- [ ] **Step 14: Install and typecheck**

Run: `pnpm install && pnpm --filter @filecloud/db typecheck`
Expected: exits 0.

- [ ] **Step 15: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat: add @filecloud/db schema, client, and drizzle-kit config"
```

---

### Task 5: Docker Compose + migrations + seed

**Files:**
- Create: `docker-compose.yml`
- Create: `packages/db/src/seed.ts`
- Modify: `apps/web/package.json` (add a `Dockerfile`-free dev-in-Docker command — not needed; web runs via `pnpm dev` on host, container is Postgres/MinIO only per the approved spec, plus the Next.js dev container)
- Create: `apps/web/Dockerfile.dev`

**Interfaces:**
- Consumes: `@filecloud/db` (`db`, `workspace`, `workspaceMember`, `folder`, `user` — used by `seed.ts`).
- Produces: a running Postgres reachable at the `DATABASE_URL` from `.env.example`, and a running MinIO with console on port 9001. `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:studio` all work against it.

- [ ] **Step 1: Create `apps/web/Dockerfile.dev`**

```dockerfile
FROM node:20-slim
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: filecloud
      POSTGRES_PASSWORD: filecloud
      POSTGRES_DB: filecloud
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-filecloud-admin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-filecloud-secret}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile.dev
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgresql://filecloud:filecloud@postgres:5432/filecloud
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - minio
    volumes:
      - ./:/repo
      - /repo/node_modules
      - /repo/apps/web/.next

volumes:
  postgres_data:
  minio_data:
```

- [ ] **Step 3: Create local `.env` from the example**

Run: `cp .env.example .env`
Then edit `.env` to set `BETTER_AUTH_SECRET` to a random 32+ character string (e.g. run `openssl rand -base64 32` and paste the output), and set `S3_ACCESS_KEY=filecloud-admin` / `S3_SECRET_KEY=filecloud-secret` to match the Compose defaults above.

- [ ] **Step 4: Start Postgres and MinIO only, verify they come up**

Run: `docker compose up -d postgres minio`
Expected: `docker compose ps` shows both `postgres` and `minio` as `running`/`healthy`. Open `http://localhost:9001` in a browser, log in with the `S3_ACCESS_KEY`/`S3_SECRET_KEY` from `.env` — MinIO console loads.

- [ ] **Step 5: Create the `filecloud` bucket in MinIO**

In the MinIO console, create a bucket named `filecloud` (matches `S3_BUCKET` in `.env`). This is a one-time manual step for local dev; automating bucket creation is deferred to the upload sub-project.

- [ ] **Step 6: Generate and run the first migration**

Run (from repo root, with `DATABASE_URL` available — export it from `.env` or run via `pnpm --filter @filecloud/db exec`):
```bash
export $(grep -v '^#' .env | xargs)
pnpm db:generate
pnpm db:migrate
```
Expected: `pnpm db:generate` writes SQL files under `packages/db/migrations/`; `pnpm db:migrate` applies them with no errors.

- [ ] **Step 7: Create `packages/db/src/seed.ts`**

```ts
import { db, user, workspace, workspaceMember, folder } from "./client";

async function seed() {
  const [devUser] = await db
    .insert(user)
    .values({
      id: "dev-user-seed",
      name: "Dev User",
      email: "dev@filecloud.local",
      emailVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  if (!devUser) {
    console.log("Seed user already exists, skipping.");
    return;
  }

  const [ws] = await db
    .insert(workspace)
    .values({ name: "Dev User's Workspace", type: "personal", ownerId: devUser.id })
    .returning();

  await db.insert(workspaceMember).values({
    workspaceId: ws.id,
    userId: devUser.id,
    role: "owner",
  });

  await db.insert(folder).values({
    workspaceId: ws.id,
    parentId: null,
    name: "root",
  });

  console.log(`Seeded workspace ${ws.id} for user ${devUser.id}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 8: Run the seed and verify via Drizzle Studio**

Run: `pnpm db:seed`
Expected: logs `Seeded workspace <uuid> for user dev-user-seed`.

Run: `pnpm db:studio`
Expected: opens a browser tab (default `https://local.drizzle.studio`); the `user`, `workspace`, `workspace_member`, and `folder` tables each show the one seeded row. Stop the studio process (Ctrl+C) when done.

- [ ] **Step 9: Verify data survives a restart**

Run: `docker compose restart postgres`
Then run `pnpm db:studio` again and confirm the seeded rows are still present.

- [ ] **Step 10: Commit**

```bash
git add docker-compose.yml apps/web/Dockerfile.dev packages/db/src/seed.ts packages/db/migrations .gitignore
git commit -m "feat: add docker compose (postgres+minio+web), first migration, and dev seed"
```

---

### Task 6: packages/storage stub (posed, not consumed yet)

**Files:**
- Create: `packages/storage/package.json`
- Create: `packages/storage/tsconfig.json`
- Create: `packages/storage/src/client.ts`
- Create: `packages/storage/src/index.ts`

**Interfaces:**
- Produces: `@filecloud/storage` exporting `minioClient` (a `Minio.Client` instance) and `S3_BUCKET` (string, from env). **Not imported by anything in this sub-project** — it exists so `packages/storage` is in place before the upload sub-project, per the approved file structure.

- [ ] **Step 1: Create `packages/storage/package.json`**

```json
{
  "name": "@filecloud/storage",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "minio": "^8.0.0"
  },
  "devDependencies": {
    "@filecloud/config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `packages/storage/tsconfig.json`**

```json
{
  "extends": "../config/tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/storage/src/client.ts`**

```ts
import { Client } from "minio";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export const minioClient = new Client({
  endPoint: requireEnv("S3_ENDPOINT"),
  port: Number(process.env.S3_PORT ?? "9000"),
  useSSL: process.env.S3_USE_SSL === "true",
  accessKey: requireEnv("S3_ACCESS_KEY"),
  secretKey: requireEnv("S3_SECRET_KEY"),
});

export const S3_BUCKET = requireEnv("S3_BUCKET");
```

- [ ] **Step 4: Create `packages/storage/src/index.ts`**

```ts
export { minioClient, S3_BUCKET } from "./client";
```

- [ ] **Step 5: Install and typecheck**

Run: `pnpm install && pnpm --filter @filecloud/storage typecheck`
Expected: exits 0. (Typecheck only — this reads `process.env` lazily via `requireEnv`, called at import time, so it is not invoked/executed by anything yet; nothing imports this package in this sub-project, so no runtime env vars are required to pass typecheck.)

- [ ] **Step 6: Commit**

```bash
git add packages/storage pnpm-lock.yaml
git commit -m "feat: add @filecloud/storage MinIO client stub (unused until upload sub-project)"
```

---

### Task 7: Better Auth server + API route

**Files:**
- Create: `apps/web/lib/auth.ts`
- Create: `apps/web/app/api/auth/[...all]/route.ts`
- Modify: `apps/web/package.json` (add `better-auth` dependency, add `@filecloud/db` dependency)

**Interfaces:**
- Consumes: `@filecloud/db` (`db`, `user`, `session`, `account`, `verification` schema).
- Produces: `apps/web/lib/auth.ts` exports `auth` (the Better Auth server instance) — consumed by the API route here, by `apps/web/lib/auth-client.ts`'s server-side session checks in Task 10, and extended with the sign-up hook in Task 8. The route `POST/GET /api/auth/*` is live.

- [ ] **Step 1: Add dependencies to `apps/web/package.json`**

```json
{
  "dependencies": {
    "@filecloud/db": "workspace:*",
    "better-auth": "^1.1.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/lib/auth.ts`**

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@filecloud/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
```

- [ ] **Step 3: Create `apps/web/app/api/auth/[...all]/route.ts`**

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 4: Install and verify the route responds**

Run: `pnpm install`
Run: `pnpm dev` (from repo root; make sure `.env` variables are loaded — Next.js reads `apps/web/.env`, so run `cp .env apps/web/.env` first if it's not already there)
In another terminal: `curl -s http://localhost:3000/api/auth/ok`
Expected: a JSON response (Better Auth's health/ok payload), not a 404. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/app/api/auth apps/web/package.json apps/web/.env pnpm-lock.yaml
git commit -m "feat: wire Better Auth server instance and API route"
```

---

### Task 8: Workspace provisioning on sign-up

**Files:**
- Create: `packages/db/src/provisioning.ts`
- Create: `packages/db/src/provisioning.test.ts`
- Create: `packages/db/vitest.config.ts`
- Modify: `apps/web/lib/auth.ts` (add `databaseHooks`)

**Interfaces:**
- Consumes: `@filecloud/db` internals (`db`, `workspace`, `workspaceMember`, `folder` — same package, relative imports).
- Produces: `provisionPersonalWorkspace(input: { userId: string; userName: string }): Promise<{ workspaceId: string; rootFolderId: string }>`, exported from `@filecloud/db`. Consumed by `apps/web/lib/auth.ts`'s `databaseHooks.user.create.after` hook.

- [ ] **Step 1: Create `packages/db/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
  },
});
```

- [ ] **Step 2: Write the failing test — `packages/db/src/provisioning.test.ts`**

This test runs against the real dockerized Postgres (via `DATABASE_URL`), since `provisionPersonalWorkspace` is a thin transactional wrapper with no logic worth mocking. It creates its own `user` row per test run (unique id) and cleans up after itself.

```ts
import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, user, workspace, workspaceMember, folder } from "./client";
import { provisionPersonalWorkspace } from "./provisioning";

describe("provisionPersonalWorkspace", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const userId of createdUserIds.splice(0)) {
      await db.delete(user).where(eq(user.id, userId));
    }
  });

  it("creates a personal workspace, root folder, and owner membership", async () => {
    const userId = `test-user-${randomUUID()}`;
    createdUserIds.push(userId);
    await db.insert(user).values({
      id: userId,
      name: "Test User",
      email: `${userId}@example.com`,
    });

    const result = await provisionPersonalWorkspace({ userId, userName: "Test User" });

    const [ws] = await db.select().from(workspace).where(eq(workspace.id, result.workspaceId));
    expect(ws.name).toBe("Test User's Workspace");
    expect(ws.type).toBe("personal");
    expect(ws.ownerId).toBe(userId);

    const [member] = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, result.workspaceId));
    expect(member.userId).toBe(userId);
    expect(member.role).toBe("owner");

    const [root] = await db.select().from(folder).where(eq(folder.id, result.rootFolderId));
    expect(root.workspaceId).toBe(result.workspaceId);
    expect(root.parentId).toBeNull();
    expect(root.name).toBe("root");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Prerequisite: `docker compose up -d postgres` must already be running (Task 5) and `DATABASE_URL` exported (`export $(grep -v '^#' .env | xargs)`).

Run: `pnpm --filter @filecloud/db test`
Expected: FAIL — `Cannot find module './provisioning'` (or equivalent "no such export `provisionPersonalWorkspace`").

- [ ] **Step 4: Implement `packages/db/src/provisioning.ts`**

```ts
import { db, workspace, workspaceMember, folder } from "./client";

export async function provisionPersonalWorkspace(input: {
  userId: string;
  userName: string;
}): Promise<{ workspaceId: string; rootFolderId: string }> {
  return db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspace)
      .values({
        name: `${input.userName}'s Workspace`,
        type: "personal",
        ownerId: input.userId,
      })
      .returning();

    await tx.insert(workspaceMember).values({
      workspaceId: ws.id,
      userId: input.userId,
      role: "owner",
    });

    const [root] = await tx
      .insert(folder)
      .values({
        workspaceId: ws.id,
        parentId: null,
        name: "root",
      })
      .returning();

    return { workspaceId: ws.id, rootFolderId: root.id };
  });
}
```

- [ ] **Step 5: Export it from the package entry point**

Edit `packages/db/src/client.ts`, add at the bottom:
```ts
export { provisionPersonalWorkspace } from "./provisioning";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @filecloud/db test`
Expected: PASS — 1 test passed.

- [ ] **Step 7: Wire the hook into Better Auth**

Edit `apps/web/lib/auth.ts`, add `databaseHooks`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, provisionPersonalWorkspace } from "@filecloud/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await provisionPersonalWorkspace({ userId: user.id, userName: user.name });
        },
      },
    },
  },
});
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/provisioning.ts packages/db/src/provisioning.test.ts packages/db/vitest.config.ts packages/db/src/client.ts packages/db/package.json apps/web/lib/auth.ts pnpm-lock.yaml
git commit -m "feat: auto-provision personal workspace on user sign-up"
```

---

### Task 9: Auth client + login/register pages

**Files:**
- Create: `apps/web/lib/auth-client.ts`
- Create: `apps/web/app/register/page.tsx`
- Create: `apps/web/app/login/page.tsx`

**Interfaces:**
- Consumes: `apps/web/lib/auth.ts` (via the `/api/auth/*` route, not directly — the client talks HTTP).
- Produces: `authClient` (exported from `apps/web/lib/auth-client.ts`) with `authClient.signUp.email(...)`, `authClient.signIn.email(...)`, `authClient.signOut()`, `authClient.useSession()` — consumed by the login/register pages here and by the dashboard layout in Task 10.

- [ ] **Step 1: Create `apps/web/lib/auth-client.ts`**

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
});
```

- [ ] **Step 2: Add `NEXT_PUBLIC_BETTER_AUTH_URL` to env files**

Edit `.env.example` and `.env` (and `apps/web/.env`), add:
```env
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

- [ ] **Step 3: Create `apps/web/app/register/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message ?? "Registration failed");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto" }}>
      <h1>Create your account</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Register"}
        </button>
      </form>
      <p>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Create `apps/web/app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Login failed");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto" }}>
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p>
        No account yet? <a href="/register">Register</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `pnpm dev`, visit `http://localhost:3000/register`, fill the form with a fresh email, submit.
Expected: redirected to `/dashboard` (will 404 or show a blank Next.js page until Task 10 — that's fine, confirms navigation happened, i.e. sign-up succeeded).
Run `pnpm db:studio` and confirm: a new `user` row, a new `workspace` row named `"<name>'s Workspace"`, a `workspace_member` row with `role: "owner"`, and a `folder` row named `"root"` with `parent_id: null`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/auth-client.ts apps/web/app/register apps/web/app/login .env.example .env apps/web/.env
git commit -m "feat: add auth client, login and register pages"
```

---

### Task 10: Protected dashboard

**Files:**
- Create: `apps/web/app/dashboard/layout.tsx`
- Create: `apps/web/app/dashboard/page.tsx`
- Create: `apps/web/middleware.ts`

**Interfaces:**
- Consumes: `apps/web/lib/auth.ts` (`auth.api.getSession`), `apps/web/lib/auth-client.ts` (`authClient.signOut`).
- Produces: `/dashboard` renders only for authenticated users; unauthenticated requests redirect to `/login`.

- [ ] **Step 1: Create `apps/web/middleware.ts` (optimistic cookie check)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

- [ ] **Step 2: Create `apps/web/app/dashboard/layout.tsx` (authoritative server-side check)**

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  return <div>{children}</div>;
}
```

- [ ] **Step 3: Create `apps/web/app/dashboard/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      <p>Welcome{session?.user?.name ? `, ${session.user.name}` : ""}.</p>
      <button onClick={handleSignOut}>Log out</button>
    </main>
  );
}
```

- [ ] **Step 4: Manual verification — full auth flow**

Run: `pnpm dev`.
1. Visit `http://localhost:3000/dashboard` while logged out → redirected to `/login`.
2. Register a new account at `/register` → redirected to `/dashboard`, page shows "Welcome, <name>." and a "Log out" button.
3. Click "Log out" → redirected to `/login`.
4. Log back in with the same credentials at `/login` → redirected to `/dashboard` again.

Expected: all four steps behave as described, no console errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/middleware.ts apps/web/app/dashboard
git commit -m "feat: protect /dashboard with session middleware and server-side check"
```

---

### Task 11: Kumo design system + `/design-system` page

**Files:**
- Modify: `apps/web/package.json` (add `@cloudflare/kumo`, `@phosphor-icons/react`)
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/app/design-system/page.tsx`

**Interfaces:**
- Produces: `/design-system` route rendering the retained Kumo components. No other task depends on this page's internals.

- [ ] **Step 1: Add dependencies**

Run: `pnpm --filter @filecloud/web add @cloudflare/kumo @phosphor-icons/react`

- [ ] **Step 2: Wire Tailwind source + Kumo styles into `apps/web/app/globals.css`**

Edit the top of `apps/web/app/globals.css` (keep whatever `create-next-app` generated below these lines):

```css
@source "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";
@import "tailwindcss";
@import "@cloudflare/kumo/styles/tailwind";
```

- [ ] **Step 3: Create `apps/web/app/design-system/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Menu,
  MenuItem,
  Dialog,
  Tooltip,
  Table,
  Skeleton,
  Toast,
  Dropdown,
  Breadcrumbs,
  BreadcrumbItem,
  Tabs,
  Tab,
  Progress,
} from "@cloudflare/kumo";

export default function DesignSystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <h1>FileCloud Design System</h1>

      <section>
        <h2>Buttons</h2>
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
      </section>

      <section>
        <h2>Inputs</h2>
        <Input placeholder="Search files…" />
      </section>

      <section>
        <h2>Menu / Dropdown</h2>
        <Dropdown label="Actions">
          <Menu>
            <MenuItem>Rename</MenuItem>
            <MenuItem>Move</MenuItem>
            <MenuItem>Delete</MenuItem>
          </Menu>
        </Dropdown>
      </section>

      <section>
        <h2>Tooltip</h2>
        <Tooltip content="Download this file">
          <Button>Download</Button>
        </Tooltip>
      </section>

      <section>
        <h2>Table</h2>
        <Table
          data={[
            { name: "report.pdf", size: "1.2 MB" },
            { name: "avatar.png", size: "84 KB" },
          ]}
          columns={[
            { key: "name", header: "Name" },
            { key: "size", header: "Size" },
          ]}
        />
      </section>

      <section>
        <h2>Skeleton</h2>
        <Skeleton style={{ width: 200, height: 20 }} />
      </section>

      <section>
        <h2>Breadcrumbs</h2>
        <Breadcrumbs>
          <BreadcrumbItem href="/dashboard">My files</BreadcrumbItem>
          <BreadcrumbItem href="/dashboard/photos">Photos</BreadcrumbItem>
        </Breadcrumbs>
      </section>

      <section>
        <h2>Tabs</h2>
        <Tabs defaultValue="grid">
          <Tab value="grid">Grid</Tab>
          <Tab value="list">List</Tab>
        </Tabs>
      </section>

      <section>
        <h2>Progress</h2>
        <Progress value={62} />
      </section>

      <Toast title="Upload complete" description="report.pdf was uploaded successfully." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <p>This is a Kumo dialog.</p>
        <Button onClick={() => setDialogOpen(false)}>Close</Button>
      </Dialog>
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`, visit `http://localhost:3000/design-system`.
Expected: page renders all sections with Kumo-styled components (not unstyled HTML), no console errors. Click "Open dialog" — the Kumo `Dialog` opens and closes. If any imported component name doesn't exist in the installed `@cloudflare/kumo` version, check `node_modules/@cloudflare/kumo/dist/index.d.ts` (or the Kumo registry at kumo-ui.com/registry) for the correct export name and fix the import — component names are the one part of this step that may drift between Kumo versions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/app/globals.css apps/web/app/design-system pnpm-lock.yaml
git commit -m "feat: install Kumo and add /design-system showcase page"
```

---

### Task 12: apps/worker placeholder

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/README.md`

**Interfaces:**
- Produces: nothing consumed elsewhere — `apps/worker` exists as a workspace member so `pnpm install` recognizes it, but is not started by `pnpm dev` and has no Docker Compose service.

- [ ] **Step 1: Create `apps/worker/package.json`**

```json
{
  "name": "@filecloud/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@filecloud/config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `apps/worker/tsconfig.json`**

```json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `apps/worker/src/index.ts`**

```ts
// Placeholder — this worker is wired up starting at plan step 12 of CLAUDE.md
// (thumbnail generation, async jobs). Not started by `pnpm dev` or Docker Compose yet.
export {};
```

- [ ] **Step 4: Create `apps/worker/README.md`**

```markdown
# @filecloud/worker

Placeholder package. This worker will consume a `jobs` table for thumbnail
generation, metadata extraction, and deferred deletion — see step 12 of the
plan in the repo root `CLAUDE.md`. It is not yet started by `pnpm dev` or
included in `docker-compose.yml`.
```

- [ ] **Step 5: Install and typecheck**

Run: `pnpm install && pnpm --filter @filecloud/worker typecheck`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/worker pnpm-lock.yaml
git commit -m "chore: add apps/worker placeholder package"
```

---

### Task 13: Full-stack verification

**Files:** none (verification only).

**Interfaces:** none — this task exercises every interface produced by Tasks 1–12 end to end.

- [ ] **Step 1: Clean slate Docker verification**

Run:
```bash
docker compose down
docker compose up --build -d
docker compose ps
```
Expected: `postgres`, `minio`, and `web` all show as `running`. Visit `http://localhost:3000` — the app loads through the `web` container (not the host `pnpm dev` process).

- [ ] **Step 2: Full auth flow against the Dockerized stack**

Register a new account at `http://localhost:3000/register`, confirm redirect to `/dashboard`, confirm `pnpm db:studio` (run on host, pointed at the same `DATABASE_URL`) shows the new `user`/`workspace`/`workspace_member`/`folder` rows. Log out, log back in.

- [ ] **Step 3: Verify persistence across restarts**

Run: `docker compose restart postgres minio`
Then repeat the login from Step 2 with the same credentials — session should be invalidated (Better Auth session table survives, but re-login must still work), and the workspace data must still be present in `pnpm db:studio`.

- [ ] **Step 4: Verify lint/typecheck/tests pass across the whole workspace**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all exit 0 across every package (`@filecloud/web`, `@filecloud/db`, `@filecloud/types`, `@filecloud/storage`, `@filecloud/worker`).

- [ ] **Step 5: Tear down**

Run: `docker compose down`
(Keeps named volumes — data persists for next session.)

- [ ] **Step 6: Update root README with local dev instructions**

Create `README.md` at repo root:

```markdown
# FileCloud

Self-hosted file manager. See `CLAUDE.md` for the full product plan and
`docs/superpowers/specs/` for sub-project specs.

## Local development

1. `cp .env.example .env` and fill in `BETTER_AUTH_SECRET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
2. `cp .env apps/web/.env`
3. `pnpm install`
4. `docker compose up -d postgres minio`
5. Create the `filecloud` bucket in the MinIO console at `http://localhost:9001`.
6. `export $(grep -v '^#' .env | xargs)`
7. `pnpm db:migrate`
8. `pnpm dev` — app runs at `http://localhost:3000`.

Or run everything in Docker: `docker compose up --build`.
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: add local development instructions"
```

---

## Self-Review Notes

- **Spec coverage:** monorepo (Task 1–3), Kumo showcase (Task 11), Docker (Task 5), full schema + unique constraints (Task 4), Better Auth + auto-provisioning (Task 7–8), protected dashboard (Task 10), login/register (Task 9), worker placeholder (Task 12) — all six spec deliverables are covered; Task 13 exercises every manual-verification bullet from the spec's "Tests / vérification manuelle" section.
- **Type consistency:** `provisionPersonalWorkspace({ userId, userName })` signature is defined once in Task 8 Step 4 and consumed identically in Task 8 Step 7 (`auth.ts` hook) — no drift. Schema table/column names introduced in Task 4 are reused verbatim in Task 5 (`seed.ts`) and Task 8 (`provisioning.ts`/test).
- **No placeholders:** every step ships literal file contents or an exact runnable command; the one caveat is flagged explicitly in Task 11 Step 4 (Kumo export names may need a lookup against the installed version — not a TODO, a known external-library risk called out with the resolution path).
