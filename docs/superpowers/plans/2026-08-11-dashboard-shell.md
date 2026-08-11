# Dashboard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full FileCloud dashboard shell (sidebar, header, file table/grid with view toggle, detail panel, breadcrumb navigation) against mocked data, replacing the current placeholder `/dashboard` welcome page.

**Architecture:** `FileBrowser` (client component) is the single source of truth for navigation/selection/view-mode state (`useState`, no new state library). It renders inside a `(shell)` Next.js route group whose layout renders the persistent `DashboardShell` (Kumo `Sidebar` + header) around every `/dashboard/*` page. Mock data in `apps/web/lib/mock-files.ts` mirrors the real `folder`/`file` DB schema shape so swapping to live data later is a data-source change, not a component redesign. Every Kumo component used below has been verified against the real installed `@cloudflare/kumo@2.9.2` type declarations (not guessed) — exact import names and prop shapes are given in each task.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, `@cloudflare/kumo` 2.9.2, `@phosphor-icons/react` 2.1.10, Tailwind CSS v4 (generic utility classes only — no unverified Kumo-specific color tokens are used, to avoid guessing).

## Global Constraints

- Product name FileCloud; this sub-project only touches `apps/web` (no `packages/*` changes).
- **No new state library.** `FileBrowser` owns `currentFolderId`, `selectedItemId`, `viewMode` via `useState`; state is passed down as props. Do not introduce Context, Zustand, Redux, etc.
- **No URL-based folder routing.** Folder navigation is client-side state only (`currentFolderId: string | null`); there is no `/dashboard/files/[...path]` route. This means refreshing the page or deep-linking to a specific mocked subfolder does not preserve navigation — accepted trade-off, documented in the design spec.
- **Route group required for persistent shell chrome.** `app/dashboard/layout.tsx` (the existing session-auth guard) is left untouched. A new `app/dashboard/(shell)/layout.tsx` renders `DashboardShell` around every page below it — this is how the sidebar/header persist across `/dashboard`, `/dashboard/shared`, `/dashboard/favorites`, `/dashboard/trash`, `/dashboard/settings` without adding a URL segment (parenthesized route-group folders are excluded from the URL). This is a necessary implementation detail beyond what the design spec's prose describes, but is required to satisfy the spec's "sidebar/header persist across dashboard routes" requirement.
- **Breadcrumbs live in `FileBrowser`'s content area, not the persistent header.** The header (`DashboardHeader`) is rendered by the `(shell)` layout, a sibling of the page content in the component tree — it cannot read `FileBrowser`'s local `currentFolderId` state without introducing shared state, which the no-new-state-library constraint forbids. The header instead shows a static page title derived from the current pathname (e.g. "Mes fichiers", "Partagés"); the real interactive folder breadcrumb (`FileBreadcrumbs`) is rendered by `FileBrowser` itself, above the file list.
- **Sidebar links** (Partagés, Favoris, Corbeille, Réglages) are real navigable Next.js routes to a dedicated "coming soon" page each — never a toast, never a 404.
- **Header action buttons** (Nouveau dossier, Upload) and **row-menu actions** (Renommer, Déplacer, Supprimer) are clickable and show a Kumo toast "Bientôt disponible" — no real action, no `disabled` state.
- **Detail panel** is hidden by default (`selectedItemId === null` ⇒ not rendered) and appears only when an item is selected.
- Every new component that needs `useKumoToastManager()` or `Tooltip` relies on the `Toasty`/`TooltipProvider` wrapper established once in `DashboardShell` (Task 10) — earlier component tasks only need to typecheck standalone, not render live with working toasts.
- Kumo's `LinkProvider` is wired once at the root layout (Task 1) so every Kumo component that accepts an `href` (Sidebar `MenuButton`, etc.) navigates via Next.js's client-side router instead of a full page reload.

---

## File Structure

```
apps/web/
├── app/
│   ├── layout.tsx                          # MODIFY: wrap children in AppLinkProvider, fix metadata title
│   └── dashboard/
│       ├── layout.tsx                       # UNCHANGED (session auth guard)
│       ├── page.tsx                         # DELETE (replaced by (shell)/page.tsx)
│       └── (shell)/                         # NEW route group — no URL segment added
│           ├── layout.tsx                   # NEW: renders <DashboardShell>{children}</DashboardShell>
│           ├── page.tsx                     # NEW: renders <FileBrowser />
│           ├── shared/page.tsx               # NEW: ComingSoon
│           ├── favorites/page.tsx            # NEW: ComingSoon
│           ├── trash/page.tsx                 # NEW: ComingSoon
│           └── settings/page.tsx              # NEW: ComingSoon
├── components/
│   ├── shell/
│   │   ├── app-link-provider.tsx            # Kumo LinkProvider ↔ next/link bridge
│   │   ├── dashboard-shell.tsx              # Sidebar.Provider + Toasty + TooltipProvider composition
│   │   ├── dashboard-sidebar.tsx            # Sidebar nav (Fichiers/Partagés/Favoris/Corbeille/Réglages)
│   │   ├── dashboard-header.tsx             # Sidebar trigger, page title, search, actions, avatar menu
│   │   └── coming-soon.tsx                  # Generic Empty-based placeholder
│   └── files/
│       ├── file-browser.tsx                 # State owner; composes everything below
│       ├── file-preview.tsx                 # Icon-by-type placeholder (no real file rendering)
│       ├── file-breadcrumbs.tsx             # Interactive folder path
│       ├── file-table.tsx                   # Table view
│       ├── file-grid.tsx                    # Grid view
│       ├── file-row-menu.tsx                # Per-row "..." dropdown (Renommer/Déplacer/Supprimer)
│       ├── file-details-panel.tsx           # Right-hand detail panel
│       └── upload-dropzone.tsx              # Empty-folder state with drop target
└── lib/
    └── mock-files.ts                        # MockItem type, MOCK_ITEMS, and pure helper functions
```

---

### Task 1: Foundations — mock data and Kumo/Next.js Link bridge

**Files:**
- Create: `apps/web/lib/mock-files.ts`
- Create: `apps/web/components/shell/app-link-provider.tsx`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Produces: `MockItem` type, `MOCK_ITEMS: MockItem[]`, `getChildren(items, parentId)`, `getItemById(items, id)`, `getBreadcrumbPath(items, folderId)`, `formatFileSize(bytes)` — all exported from `@/lib/mock-files`, consumed by every component in `components/files/*` (Tasks 2–9). Produces `AppLinkProvider` — consumed only here, wrapping the whole app.

- [ ] **Step 1: Create `apps/web/lib/mock-files.ts`**

```ts
export type MockItemType = "file" | "folder";

export type MockItem = {
  id: string;
  parentId: string | null;
  type: MockItemType;
  name: string;
  mimeType: string | null;
  size: number | null;
  updatedAt: string;
  owner: string;
};

export const MOCK_ITEMS: MockItem[] = [
  {
    id: "documents",
    parentId: null,
    type: "folder",
    name: "Documents",
    mimeType: null,
    size: null,
    updatedAt: "2026-08-01T10:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "photos",
    parentId: null,
    type: "folder",
    name: "Photos",
    mimeType: null,
    size: null,
    updatedAt: "2026-07-28T14:30:00.000Z",
    owner: "Dev User",
  },
  {
    id: "projects",
    parentId: null,
    type: "folder",
    name: "Projects",
    mimeType: null,
    size: null,
    updatedAt: "2026-08-05T09:15:00.000Z",
    owner: "Dev User",
  },
  {
    id: "welcome",
    parentId: null,
    type: "file",
    name: "welcome.pdf",
    mimeType: "application/pdf",
    size: 245_000,
    updatedAt: "2026-07-20T08:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "notes",
    parentId: null,
    type: "file",
    name: "notes.md",
    mimeType: "text/markdown",
    size: 3_200,
    updatedAt: "2026-08-09T16:45:00.000Z",
    owner: "Dev User",
  },
  {
    id: "contracts",
    parentId: "documents",
    type: "folder",
    name: "Contracts",
    mimeType: null,
    size: null,
    updatedAt: "2026-07-15T11:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "invoice-2026",
    parentId: "documents",
    type: "file",
    name: "invoice-2026.pdf",
    mimeType: "application/pdf",
    size: 128_500,
    updatedAt: "2026-08-02T13:20:00.000Z",
    owner: "Dev User",
  },
  {
    id: "budget",
    parentId: "documents",
    type: "file",
    name: "budget.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 54_000,
    updatedAt: "2026-07-30T09:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "contract-acme",
    parentId: "contracts",
    type: "file",
    name: "contract-acme.pdf",
    mimeType: "application/pdf",
    size: 98_000,
    updatedAt: "2026-07-16T10:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "sunset",
    parentId: "photos",
    type: "file",
    name: "sunset.jpg",
    mimeType: "image/jpeg",
    size: 3_400_000,
    updatedAt: "2026-07-28T14:31:00.000Z",
    owner: "Dev User",
  },
  {
    id: "team-offsite",
    parentId: "photos",
    type: "file",
    name: "team-offsite.png",
    mimeType: "image/png",
    size: 5_100_000,
    updatedAt: "2026-07-25T18:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "filecloud-project",
    parentId: "projects",
    type: "folder",
    name: "FileCloud",
    mimeType: null,
    size: null,
    updatedAt: "2026-08-05T09:16:00.000Z",
    owner: "Dev User",
  },
  {
    id: "roadmap",
    parentId: "projects",
    type: "file",
    name: "roadmap.md",
    mimeType: "text/markdown",
    size: 8_900,
    updatedAt: "2026-08-05T09:20:00.000Z",
    owner: "Dev User",
  },
];

export function getChildren(items: MockItem[], parentId: string | null): MockItem[] {
  return items.filter((item) => item.parentId === parentId);
}

export function getItemById(items: MockItem[], id: string): MockItem | undefined {
  return items.find((item) => item.id === id);
}

export function getBreadcrumbPath(items: MockItem[], folderId: string | null): MockItem[] {
  const path: MockItem[] = [];
  let currentId = folderId;
  while (currentId !== null) {
    const item = getItemById(items, currentId);
    if (!item) break;
    path.unshift(item);
    currentId = item.parentId;
  }
  return path;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value < 10 && unitIndex > 0 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}
```

- [ ] **Step 2: Create `apps/web/components/shell/app-link-provider.tsx`**

This follows Kumo's own documented Next.js integration pattern exactly (from `LinkProvider`'s JSDoc in `node_modules/@cloudflare/kumo/dist/link-provider-tz-NJp9x.d.ts`).

```tsx
"use client";

import { forwardRef } from "react";
import NextLink from "next/link";
import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo";

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>((props, ref) => (
  <NextLink ref={ref} {...props} />
));
AppLink.displayName = "AppLink";

export function AppLinkProvider({ children }: { children: React.ReactNode }) {
  return <LinkProvider component={AppLink}>{children}</LinkProvider>;
}
```

If `tsc` reports that `NextLink`'s `href` prop doesn't accept `undefined` (since `LinkComponentProps.href` is optional but `next/link`'s `href` is required), change the spread to `<NextLink ref={ref} {...props} href={props.href ?? "#"} />` instead — try the exact doc pattern above first.

- [ ] **Step 3: Wire `AppLinkProvider` into the root layout and fix leftover boilerplate metadata**

Edit `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppLinkProvider } from "@/components/shell/app-link-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FileCloud",
  description: "Gestionnaire de fichiers self-hosted.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppLinkProvider>{children}</AppLinkProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 5: Manual sanity check**

Run: `pnpm dev`, visit `http://localhost:3000/login` and `http://localhost:3000/design-system`.
Expected: both pages still render correctly (root layout change doesn't break existing pages), browser tab title shows "FileCloud". Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/mock-files.ts apps/web/components/shell/app-link-provider.tsx apps/web/app/layout.tsx
git commit -m "feat: add mock file data and Kumo/Next.js link integration"
```

---

### Task 2: `file-preview.tsx` — icon-by-type placeholder

**Files:**
- Create: `apps/web/components/files/file-preview.tsx`

**Interfaces:**
- Consumes: `MockItem` from `@/lib/mock-files` (Task 1).
- Produces: `FilePreviewIcon({ item: MockItem; size?: number })` — consumed by `file-table.tsx` (Task 5), `file-grid.tsx` (Task 6), `file-details-panel.tsx` (Task 8).

- [ ] **Step 1: Create `apps/web/components/files/file-preview.tsx`**

```tsx
import type { Icon } from "@phosphor-icons/react";
import { FolderSimpleIcon, FilePdfIcon, ImageIcon, FileTextIcon, FileIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";

function getIconForItem(item: MockItem): Icon {
  if (item.type === "folder") return FolderSimpleIcon;
  if (item.mimeType === "application/pdf") return FilePdfIcon;
  if (item.mimeType?.startsWith("image/")) return ImageIcon;
  if (item.mimeType === "text/markdown") return FileTextIcon;
  return FileIcon;
}

export function FilePreviewIcon({ item, size = 20 }: { item: MockItem; size?: number }) {
  const IconComponent = getIconForItem(item);
  return <IconComponent size={size} />;
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/files/file-preview.tsx
git commit -m "feat: add file-preview icon-by-type component"
```

---

### Task 3: `file-breadcrumbs.tsx` — interactive folder path

**Files:**
- Create: `apps/web/components/files/file-breadcrumbs.tsx`

**Interfaces:**
- Consumes: `MockItem` from `@/lib/mock-files` (Task 1).
- Produces: `FileBreadcrumbs({ path: MockItem[]; onNavigate: (folderId: string | null) => void })` — consumed by `file-browser.tsx` (Task 9).

**Note on Kumo API:** `Breadcrumbs.Link`'s real type (`node_modules/@cloudflare/kumo/dist/index-CLsBWiaS.d.ts`) only accepts `{ href, icon, children }` — no `onClick`. Since our breadcrumb navigation is client-state only (no real URLs per folder), we don't use `Breadcrumbs.Link` for the interactive crumbs; we use plain `<button>` elements between `Breadcrumbs.Separator`/`Breadcrumbs.Current` instead. This is a deliberate substitution, not a mistake — do not try to force `onClick` onto `Breadcrumbs.Link`, it will fail to typecheck.

- [ ] **Step 1: Create `apps/web/components/files/file-breadcrumbs.tsx`**

```tsx
"use client";

import { Fragment } from "react";
import { Breadcrumbs } from "@cloudflare/kumo";
import type { MockItem } from "@/lib/mock-files";

export function FileBreadcrumbs({
  path,
  onNavigate,
}: {
  path: MockItem[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <Breadcrumbs>
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
      >
        Mes fichiers
      </button>
      {path.map((folder, index) => {
        const isLast = index === path.length - 1;
        return (
          <Fragment key={folder.id}>
            <Breadcrumbs.Separator />
            {isLast ? (
              <Breadcrumbs.Current>{folder.name}</Breadcrumbs.Current>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(folder.id)}
                className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
              >
                {folder.name}
              </button>
            )}
          </Fragment>
        );
      })}
    </Breadcrumbs>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/files/file-breadcrumbs.tsx
git commit -m "feat: add interactive file-breadcrumbs component"
```

---

### Task 4: `file-row-menu.tsx` — per-row action menu

**Files:**
- Create: `apps/web/components/files/file-row-menu.tsx`

**Interfaces:**
- Consumes: `MockItem` from `@/lib/mock-files` (Task 1).
- Produces: `FileRowMenu({ item: MockItem })` — consumed by `file-table.tsx` (Task 5).
- Calls `useKumoToastManager()` — requires a `Toasty` ancestor at runtime, provided by `DashboardShell` (Task 10). Typecheck/lint pass standalone regardless; live toast behavior is verified in Task 12.

- [ ] **Step 1: Create `apps/web/components/files/file-row-menu.tsx`**

```tsx
"use client";

import { DropdownMenu, Button, useKumoToastManager } from "@cloudflare/kumo";
import { DotsThreeIcon, PencilSimpleIcon, ArrowsOutCardinalIcon, TrashIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";

export function FileRowMenu({ item }: { item: MockItem }) {
  const toasts = useKumoToastManager();

  function notImplemented(action: string) {
    toasts.add({
      title: "Bientôt disponible",
      description: `"${action}" pour "${item.name}" n'est pas encore implémenté.`,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button
          variant="secondary"
          shape="square"
          icon={DotsThreeIcon}
          aria-label={`Actions pour ${item.name}`}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item icon={PencilSimpleIcon} onClick={() => notImplemented("Renommer")}>
          Renommer
        </DropdownMenu.Item>
        <DropdownMenu.Item icon={ArrowsOutCardinalIcon} onClick={() => notImplemented("Déplacer")}>
          Déplacer
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="danger" icon={TrashIcon} onClick={() => notImplemented("Supprimer")}>
          Supprimer
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/files/file-row-menu.tsx
git commit -m "feat: add file-row-menu with not-implemented toast actions"
```

---

### Task 5: `file-table.tsx` — table view

**Files:**
- Create: `apps/web/components/files/file-table.tsx`

**Interfaces:**
- Consumes: `MockItem`, `formatFileSize` from `@/lib/mock-files` (Task 1); `FilePreviewIcon` (Task 2); `FileRowMenu` (Task 4).
- Produces: `FileTable({ items, selectedItemId, onOpenFolder, onSelectItem })` — consumed by `file-browser.tsx` (Task 9). Same prop signature as `FileGrid` (Task 6) — keep them identical so `file-browser.tsx` can swap between the two without branching logic beyond the component itself.

- [ ] **Step 1: Create `apps/web/components/files/file-table.tsx`**

```tsx
"use client";

import { Table } from "@cloudflare/kumo";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon } from "./file-preview";
import { FileRowMenu } from "./file-row-menu";

export function FileTable({
  items,
  selectedItemId,
  onOpenFolder,
  onSelectItem,
}: {
  items: MockItem[];
  selectedItemId: string | null;
  onOpenFolder: (folderId: string) => void;
  onSelectItem: (itemId: string | null) => void;
}) {
  function handleActivate(item: MockItem) {
    if (item.type === "folder") {
      onOpenFolder(item.id);
    } else {
      onSelectItem(selectedItemId === item.id ? null : item.id);
    }
  }

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Nom</Table.Head>
          <Table.Head>Propriétaire</Table.Head>
          <Table.Head>Modifié</Table.Head>
          <Table.Head>Taille</Table.Head>
          <Table.Head></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((item) => (
          <Table.Row key={item.id} variant={selectedItemId === item.id ? "selected" : "default"}>
            <Table.Cell>
              <button
                type="button"
                onClick={() => handleActivate(item)}
                className="flex items-center gap-2 border-0 bg-transparent p-0 text-left font-inherit"
              >
                <FilePreviewIcon item={item} />
                {item.name}
              </button>
            </Table.Cell>
            <Table.Cell>{item.owner}</Table.Cell>
            <Table.Cell>{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</Table.Cell>
            <Table.Cell>{formatFileSize(item.size)}</Table.Cell>
            <Table.Cell>
              <FileRowMenu item={item} />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
```

Note: the name button is a native `<button>`, so it's Tab-focusable and Enter/Space-activatable without any extra keyboard handling — this satisfies the "utilisation clavier correcte" requirement for row activation.

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/files/file-table.tsx
git commit -m "feat: add file-table view"
```

---

### Task 6: `file-grid.tsx` — grid view

**Files:**
- Create: `apps/web/components/files/file-grid.tsx`

**Interfaces:**
- Consumes: `MockItem`, `formatFileSize` from `@/lib/mock-files` (Task 1); `FilePreviewIcon` (Task 2).
- Produces: `FileGrid({ items, selectedItemId, onOpenFolder, onSelectItem })` — same signature as `FileTable` (Task 5), consumed by `file-browser.tsx` (Task 9).

- [ ] **Step 1: Create `apps/web/components/files/file-grid.tsx`**

```tsx
"use client";

import { Grid, GridItem, LayerCard } from "@cloudflare/kumo";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon } from "./file-preview";

export function FileGrid({
  items,
  selectedItemId,
  onOpenFolder,
  onSelectItem,
}: {
  items: MockItem[];
  selectedItemId: string | null;
  onOpenFolder: (folderId: string) => void;
  onSelectItem: (itemId: string | null) => void;
}) {
  function handleActivate(item: MockItem) {
    if (item.type === "folder") {
      onOpenFolder(item.id);
    } else {
      onSelectItem(selectedItemId === item.id ? null : item.id);
    }
  }

  return (
    <Grid variant="4up" gap="sm">
      {items.map((item) => (
        <GridItem key={item.id}>
          <LayerCard
            render={<button type="button" />}
            onClick={() => handleActivate(item)}
            className={
              selectedItemId === item.id
                ? "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-blue-500 p-4"
                : "flex w-full flex-col items-center gap-2 rounded-lg border border-transparent p-4 hover:border-gray-200"
            }
          >
            <FilePreviewIcon item={item} size={32} />
            <span className="w-full truncate text-center text-sm">{item.name}</span>
            <span className="text-xs text-gray-500">{formatFileSize(item.size)}</span>
          </LayerCard>
        </GridItem>
      ))}
    </Grid>
  );
}
```

`LayerCard`'s `render` prop follows the same Base UI `render`-element pattern already used elsewhere in this codebase (e.g. `Dialog.Close render={<Button>Close</Button>}` in `apps/web/app/design-system/page.tsx`) — it renders as the given element instead of its default `<div>`, receiving the merged `onClick`/`className`/children.

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/files/file-grid.tsx
git commit -m "feat: add file-grid view"
```

---

### Task 7: `upload-dropzone.tsx` — empty-folder state

**Files:**
- Create: `apps/web/components/files/upload-dropzone.tsx`

**Interfaces:**
- Produces: `UploadDropzone()` (no props) — consumed by `file-browser.tsx` (Task 9), rendered when the current folder has zero children.
- Calls `useKumoToastManager()` — same runtime dependency note as Task 4.

- [ ] **Step 1: Create `apps/web/components/files/upload-dropzone.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button, Empty, useKumoToastManager } from "@cloudflare/kumo";
import { UploadSimpleIcon } from "@phosphor-icons/react";

export function UploadDropzone() {
  const toasts = useKumoToastManager();
  const [isDragging, setIsDragging] = useState(false);

  function notifyNotImplemented() {
    toasts.add({
      title: "Bientôt disponible",
      description: "L'upload de fichiers n'est pas encore implémenté.",
    });
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        notifyNotImplemented();
      }}
      className={
        isDragging
          ? "rounded-lg border-2 border-dashed border-blue-500 bg-blue-50"
          : "rounded-lg border-2 border-dashed border-gray-300"
      }
    >
      <Empty
        icon={<UploadSimpleIcon size={40} />}
        title="Ce dossier est vide"
        description="Glissez des fichiers ici pour les ajouter, ou utilisez le bouton ci-dessous."
        contents={
          <Button variant="secondary" onClick={notifyNotImplemented}>
            Parcourir les fichiers
          </Button>
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/files/upload-dropzone.tsx
git commit -m "feat: add upload-dropzone empty-folder state"
```

---

### Task 8: `file-details-panel.tsx` — right-hand detail panel

**Files:**
- Create: `apps/web/components/files/file-details-panel.tsx`

**Interfaces:**
- Consumes: `MockItem`, `formatFileSize` from `@/lib/mock-files` (Task 1); `FilePreviewIcon` (Task 2).
- Produces: `FileDetailsPanel({ item: MockItem; onClose: () => void; onAction: (action: string) => void })` — consumed by `file-browser.tsx` (Task 9), rendered only when an item is selected.

- [ ] **Step 1: Create `apps/web/components/files/file-details-panel.tsx`**

```tsx
"use client";

import { Button } from "@cloudflare/kumo";
import { XIcon, ShareIcon, DownloadIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon } from "./file-preview";

export function FileDetailsPanel({
  item,
  onClose,
  onAction,
}: {
  item: MockItem;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <aside className="flex w-72 flex-shrink-0 flex-col gap-4 border-l border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Détails</h2>
        <Button
          variant="secondary"
          shape="square"
          icon={XIcon}
          aria-label="Fermer le panneau"
          onClick={onClose}
        />
      </div>

      <div className="flex flex-col items-center gap-2 py-4">
        <FilePreviewIcon item={item} size={48} />
        <p className="break-all text-center text-sm font-medium">{item.name}</p>
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Type</dt>
          <dd>{item.type === "folder" ? "Dossier" : item.mimeType ?? "Fichier"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Taille</dt>
          <dd>{formatFileSize(item.size)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Propriétaire</dt>
          <dd>{item.owner}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Modifié</dt>
          <dd>{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</dd>
        </div>
      </dl>

      <div className="flex gap-2">
        <Button variant="secondary" icon={ShareIcon} onClick={() => onAction("Partager")}>
          Partager
        </Button>
        <Button variant="secondary" icon={DownloadIcon} onClick={() => onAction("Télécharger")}>
          Télécharger
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/files/file-details-panel.tsx
git commit -m "feat: add file-details-panel"
```

---

### Task 9: `file-browser.tsx` — state and composition

**Files:**
- Create: `apps/web/components/files/file-browser.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–8 (`MOCK_ITEMS`, `getChildren`, `getBreadcrumbPath` from `@/lib/mock-files`; `FileBreadcrumbs`, `FileTable`, `FileGrid`, `FileDetailsPanel`, `UploadDropzone`).
- Produces: `FileBrowser()` (no props) — consumed by `app/dashboard/(shell)/page.tsx` (Task 11).

- [ ] **Step 1: Create `apps/web/components/files/file-browser.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { Tabs, useKumoToastManager } from "@cloudflare/kumo";
import { GridFourIcon, ListBulletsIcon } from "@phosphor-icons/react";
import { MOCK_ITEMS, getChildren, getBreadcrumbPath } from "@/lib/mock-files";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { FileTable } from "./file-table";
import { FileGrid } from "./file-grid";
import { FileDetailsPanel } from "./file-details-panel";
import { UploadDropzone } from "./upload-dropzone";

type ViewMode = "table" | "grid";

export function FileBrowser() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const toasts = useKumoToastManager();

  const items = useMemo(() => getChildren(MOCK_ITEMS, currentFolderId), [currentFolderId]);
  const breadcrumbPath = useMemo(() => getBreadcrumbPath(MOCK_ITEMS, currentFolderId), [currentFolderId]);
  const selectedItem = useMemo(
    () => MOCK_ITEMS.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId],
  );

  function handleOpenFolder(folderId: string) {
    setCurrentFolderId(folderId);
    setSelectedItemId(null);
  }

  function handleNavigate(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedItemId(null);
  }

  function handleDetailAction(action: string) {
    toasts.add({
      title: "Bientôt disponible",
      description: `"${action}" n'est pas encore implémenté.`,
    });
  }

  return (
    <div className="flex flex-1 gap-6">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <FileBreadcrumbs path={breadcrumbPath} onNavigate={handleNavigate} />
          <Tabs
            variant="segmented"
            size="sm"
            tabs={[
              {
                value: "table",
                label: (
                  <span className="flex items-center gap-1">
                    <ListBulletsIcon size={16} /> Liste
                  </span>
                ),
              },
              {
                value: "grid",
                label: (
                  <span className="flex items-center gap-1">
                    <GridFourIcon size={16} /> Grille
                  </span>
                ),
              },
            ]}
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
          />
        </div>

        {items.length === 0 ? (
          <UploadDropzone />
        ) : viewMode === "table" ? (
          <FileTable
            items={items}
            selectedItemId={selectedItemId}
            onOpenFolder={handleOpenFolder}
            onSelectItem={setSelectedItemId}
          />
        ) : (
          <FileGrid
            items={items}
            selectedItemId={selectedItemId}
            onOpenFolder={handleOpenFolder}
            onSelectItem={setSelectedItemId}
          />
        )}
      </div>

      {selectedItem && (
        <FileDetailsPanel
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
          onAction={handleDetailAction}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0. (Live rendering isn't verifiable yet — `FileBrowser` isn't mounted anywhere until Task 11 — but this confirms the composition is type-correct.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/files/file-browser.tsx
git commit -m "feat: add file-browser state and composition"
```

---

### Task 10: Shell — sidebar, header, and `DashboardShell` composition

**Files:**
- Create: `apps/web/components/shell/dashboard-sidebar.tsx`
- Create: `apps/web/components/shell/dashboard-header.tsx`
- Create: `apps/web/components/shell/dashboard-shell.tsx`

**Interfaces:**
- Consumes: `authClient` from `@/lib/auth-client` (existing, from the fondations+auth sub-project).
- Produces: `DashboardSidebar()`, `DashboardHeader()`, `DashboardShell({ children: React.ReactNode })` — the latter consumed by `app/dashboard/(shell)/layout.tsx` (Task 11).

- [ ] **Step 1: Create `apps/web/components/shell/dashboard-sidebar.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@cloudflare/kumo";
import { HouseIcon, ShareIcon, StarIcon, TrashIcon, GearIcon } from "@phosphor-icons/react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Fichiers", icon: HouseIcon },
  { href: "/dashboard/shared", label: "Partagés", icon: ShareIcon },
  { href: "/dashboard/favorites", label: "Favoris", icon: StarIcon },
  { href: "/dashboard/trash", label: "Corbeille", icon: TrashIcon },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <Sidebar.Header>
        <span className="px-2 text-sm font-semibold">FileCloud</span>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.Menu>
            {NAV_ITEMS.map((item) => (
              <Sidebar.MenuButton
                key={item.href}
                icon={item.icon}
                href={item.href}
                active={pathname === item.href}
              >
                {item.label}
              </Sidebar.MenuButton>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Menu>
          <Sidebar.MenuButton
            icon={GearIcon}
            href="/dashboard/settings"
            active={pathname === "/dashboard/settings"}
          >
            Réglages
          </Sidebar.MenuButton>
        </Sidebar.Menu>
      </Sidebar.Footer>
    </Sidebar>
  );
}
```

`Sidebar.MenuButton`'s `href` prop renders as a link via the `LinkProvider` wired in Task 1, so these are real client-side-routed Next.js navigations, not full page reloads.

- [ ] **Step 2: Create `apps/web/components/shell/dashboard-header.tsx`**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button, DropdownMenu, Input, Sidebar, useKumoToastManager } from "@cloudflare/kumo";
import { FolderPlusIcon, UploadSimpleIcon, UserCircleIcon, SignOutIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Mes fichiers",
  "/dashboard/shared": "Partagés",
  "/dashboard/favorites": "Favoris",
  "/dashboard/trash": "Corbeille",
  "/dashboard/settings": "Réglages",
};

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const toasts = useKumoToastManager();
  const { data: session } = authClient.useSession();

  function notifyNotImplemented(action: string) {
    toasts.add({
      title: "Bientôt disponible",
      description: `"${action}" n'est pas encore implémenté.`,
    });
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  const pageLabel = PAGE_LABELS[pathname] ?? "FileCloud";

  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <Sidebar.Trigger />
        <h1 className="text-base font-medium">{pageLabel}</h1>
      </div>

      <Input placeholder="Rechercher…" aria-label="Rechercher des fichiers" className="max-w-xs" />

      <div className="flex items-center gap-2">
        <Button variant="secondary" icon={FolderPlusIcon} onClick={() => notifyNotImplemented("Nouveau dossier")}>
          Nouveau dossier
        </Button>
        <Button variant="primary" icon={UploadSimpleIcon} onClick={() => notifyNotImplemented("Upload")}>
          Upload
        </Button>

        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Button
              variant="secondary"
              shape="circle"
              icon={UserCircleIcon}
              aria-label="Menu utilisateur"
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Label>{session?.user?.name ?? "Mon compte"}</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={SignOutIcon} onClick={handleSignOut}>
              Se déconnecter
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/shell/dashboard-shell.tsx`**

```tsx
"use client";

import { Sidebar, Toasty, TooltipProvider } from "@cloudflare/kumo";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Toasty>
      <TooltipProvider>
        <Sidebar.Provider>
          <DashboardSidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <DashboardHeader />
            <main className="flex flex-1 flex-col overflow-auto p-6">{children}</main>
          </div>
        </Sidebar.Provider>
      </TooltipProvider>
    </Toasty>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/shell/dashboard-sidebar.tsx apps/web/components/shell/dashboard-header.tsx apps/web/components/shell/dashboard-shell.tsx
git commit -m "feat: add dashboard shell (sidebar, header, Toasty/TooltipProvider composition)"
```

---

### Task 11: Wire routes — replace the dashboard page, add the `(shell)` route group and "coming soon" pages

**Files:**
- Delete: `apps/web/app/dashboard/page.tsx`
- Create: `apps/web/components/shell/coming-soon.tsx`
- Create: `apps/web/app/dashboard/(shell)/layout.tsx`
- Create: `apps/web/app/dashboard/(shell)/page.tsx`
- Create: `apps/web/app/dashboard/(shell)/shared/page.tsx`
- Create: `apps/web/app/dashboard/(shell)/favorites/page.tsx`
- Create: `apps/web/app/dashboard/(shell)/trash/page.tsx`
- Create: `apps/web/app/dashboard/(shell)/settings/page.tsx`

**Interfaces:**
- Consumes: `DashboardShell` (Task 10), `FileBrowser` (Task 9).
- Produces: the live `/dashboard`, `/dashboard/shared`, `/dashboard/favorites`, `/dashboard/trash`, `/dashboard/settings` routes.

- [ ] **Step 1: Delete the old dashboard page**

```bash
rm apps/web/app/dashboard/page.tsx
```

This file currently renders the placeholder "Welcome" message and a standalone sign-out button — both are superseded by `DashboardShell` (sidebar + `DashboardHeader`'s avatar menu, which now owns sign-out) and `FileBrowser`.

- [ ] **Step 2: Create `apps/web/components/shell/coming-soon.tsx`**

```tsx
"use client";

import { Empty } from "@cloudflare/kumo";
import type { Icon } from "@phosphor-icons/react";

export function ComingSoon({
  icon: IconComponent,
  title,
  description,
}: {
  icon: Icon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Empty icon={<IconComponent size={40} />} title={title} description={description} />
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/dashboard/(shell)/layout.tsx`**

```tsx
import { DashboardShell } from "@/components/shell/dashboard-shell";

export default function DashboardShellLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
```

- [ ] **Step 4: Create `apps/web/app/dashboard/(shell)/page.tsx`**

```tsx
import { FileBrowser } from "@/components/files/file-browser";

export default function DashboardFilesPage() {
  return <FileBrowser />;
}
```

- [ ] **Step 5: Create `apps/web/app/dashboard/(shell)/shared/page.tsx`**

```tsx
"use client";

import { ShareIcon } from "@phosphor-icons/react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SharedPage() {
  return (
    <ComingSoon
      icon={ShareIcon}
      title="Partage bientôt disponible"
      description="Le partage de fichiers et de dossiers arrive dans une prochaine mise à jour."
    />
  );
}
```

- [ ] **Step 6: Create `apps/web/app/dashboard/(shell)/favorites/page.tsx`**

```tsx
"use client";

import { StarIcon } from "@phosphor-icons/react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function FavoritesPage() {
  return (
    <ComingSoon
      icon={StarIcon}
      title="Favoris bientôt disponibles"
      description="Vous pourrez bientôt marquer des fichiers et dossiers comme favoris."
    />
  );
}
```

- [ ] **Step 7: Create `apps/web/app/dashboard/(shell)/trash/page.tsx`**

```tsx
"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function TrashPage() {
  return (
    <ComingSoon
      icon={TrashIcon}
      title="Corbeille bientôt disponible"
      description="Les éléments supprimés apparaîtront ici, avec possibilité de restauration."
    />
  );
}
```

- [ ] **Step 8: Create `apps/web/app/dashboard/(shell)/settings/page.tsx`**

```tsx
"use client";

import { GearIcon } from "@phosphor-icons/react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={GearIcon}
      title="Réglages bientôt disponibles"
      description="La gestion du profil et des préférences arrive dans une prochaine mise à jour."
    />
  );
}
```

- [ ] **Step 9: Typecheck and lint**

Run: `pnpm --filter @filecloud/web typecheck && pnpm --filter @filecloud/web lint`
Expected: both exit 0.

- [ ] **Step 10: Manual verification — routes resolve**

Run: `pnpm dev`. With a valid session cookie (register/log in first if needed, reusing the flow from the fondations+auth sub-project), confirm each of these returns 200 and no console error: `http://localhost:3000/dashboard`, `/dashboard/shared`, `/dashboard/favorites`, `/dashboard/trash`, `/dashboard/settings`. Stop the dev server.

- [ ] **Step 11: Commit**

```bash
git add -A apps/web/app/dashboard apps/web/components/shell/coming-soon.tsx
git commit -m "feat: wire dashboard shell route group and coming-soon pages"
```

---

### Task 12: Full manual verification

**Files:** none (verification only).

**Interfaces:** none — exercises every interface produced by Tasks 1–11 end to end.

- [ ] **Step 1: Full flow through the browser (or curl + visual spot-check if no browser automation is available)**

Run: `pnpm dev`, log in with an existing or freshly-registered account, land on `/dashboard`.

Verify:
1. Sidebar shows FileCloud header, Fichiers/Partagés/Favoris/Corbeille links, Réglages in the footer. "Fichiers" is highlighted as active.
2. Header shows the sidebar toggle, "Mes fichiers" title, a search input, "Nouveau dossier"/"Upload" buttons, and an avatar menu.
3. The file table shows the top-level mocked items (Documents, Photos, Projects folders; welcome.pdf, notes.md files).
4. Clicking "Documents" navigates into it (Contracts folder, invoice-2026.pdf, budget.xlsx appear); the breadcrumb now reads "Mes fichiers / Documents".
5. Clicking "Contracts" navigates one level deeper (contract-acme.pdf appears); breadcrumb reads "Mes fichiers / Documents / Contracts".
6. Clicking "Documents" in the breadcrumb navigates back up correctly; clicking "Mes fichiers" returns to the root listing.
7. Clicking a file (e.g. welcome.pdf) selects it and opens the detail panel on the right with correct name/type/size/owner/date; clicking it again (or its close button) closes the panel.
8. Toggling to the grid view re-renders the same folder's contents as cards; toggling back to table preserves the current folder.
9. Clicking "Nouveau dossier", "Upload", any row's "…" menu action, and the detail panel's "Partager"/"Télécharger" buttons each show a "Bientôt disponible" toast.
10. Clicking Partagés/Favoris/Corbeille/Réglages in the sidebar navigates to each dedicated page (not a 404), each showing its own empty-state message; the sidebar's active highlight follows.
11. The avatar menu shows the logged-in user's name and a "Se déconnecter" item; clicking it signs out and redirects to `/login`.

- [ ] **Step 2: Empty-folder state**

Navigate into "Projects" → "FileCloud" (the innermost mocked folder, which has no children in `MOCK_ITEMS`).
Expected: instead of an empty table, the `UploadDropzone` empty state renders ("Ce dossier est vide", drop target, "Parcourir les fichiers" button that also shows the not-implemented toast).

- [ ] **Step 3: Responsive check**

Resize the browser window (or use dev tools device toolbar) to a tablet width (~768px) and narrower.
Expected: the sidebar collapses to icon-only or an off-canvas/mobile mode (Kumo `Sidebar`'s built-in `mobileBreakpoint: 768` default), toggled via the header's sidebar trigger button; content remains usable, no horizontal overflow/broken layout.

- [ ] **Step 4: Keyboard check**

Using only Tab/Shift+Tab/Enter/Space (no mouse), confirm: sidebar links are reachable and activatable, file table rows' name buttons are reachable and activatable (Enter opens folders / selects files), the view-mode tabs are reachable and switchable, the row-menu "…" buttons open their dropdown and items are reachable, the avatar menu opens and "Se déconnecter" is reachable and activatable.

- [ ] **Step 5: Workspace-wide typecheck and lint**

Run: `pnpm typecheck && pnpm lint` from the repo root.
Expected: both exit 0 across every package (no regressions in `packages/db`, `packages/types`, `packages/storage`, `apps/worker` from this frontend-only sub-project).

- [ ] **Step 6: Commit (only if Step 1–4 surfaced fixes)**

If manual verification is clean, there is nothing to commit for this task. If it surfaced a bug, fix it, re-verify the specific broken behavior, and commit:

```bash
git add -A
git commit -m "fix: address issues found in dashboard shell manual verification"
```

---

## Self-Review Notes

- **Spec coverage:** every deliverable from `docs/superpowers/specs/2026-08-11-dashboard-shell-design.md` is covered — sidebar with all links (Task 10), header with search/actions/avatar (Task 10), table+grid with toggle (Tasks 5, 6, 9), detail panel shown only on selection (Tasks 8, 9), breadcrumb navigation (Tasks 3, 9), "coming soon" pages for unfinished sidebar links (Task 11), toast-based "not implemented" for header/row-menu actions (Tasks 4, 7, 10), responsive/keyboard verification (Task 12).
- **Type consistency:** `FileTable` and `FileGrid` (Tasks 5–6) share the exact same prop signature (`items`, `selectedItemId`, `onOpenFolder`, `onSelectItem`) so `FileBrowser` (Task 9) can branch between them without adapter code — verified identical across both task definitions. `MockItem`'s fields (Task 1) are used identically (`type`, `mimeType`, `size`, `updatedAt`, `owner`, `parentId`) across every consumer (Tasks 2, 3, 5, 6, 8, 9) — no renamed fields anywhere.
- **No placeholders:** every step ships literal file contents; the two intentional deviations from the design spec's literal prose (route group necessity, breadcrumb placement) are explained with rationale in Global Constraints, not left ambiguous. The one open judgment call (`AppLinkProvider`'s `href` typing, Task 1 Step 2) has a concrete fallback given inline, not a TODO.
