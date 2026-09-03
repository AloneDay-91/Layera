"use client";

import type { ReactNode } from "react";
import { Breadcrumbs, Button, Grid, GridItem, InputGroup, LayerCard, Tabs, Text, Toolbar } from "@cloudflare/kumo";
import {
  FolderPlusIcon,
  GridFourIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/kumo/page-header";
import { FileBreadcrumbs } from "@/components/files/file-breadcrumbs";
import { useNavigation } from "./navigation-provider";
import { Pulse, TableCardSkeleton } from "./table-card-skeleton";

export { TableCardSkeleton };

type SkeletonKind =
  | "files"
  | "recent"
  | "favorites"
  | "shared"
  | "links"
  | "archive"
  | "trash"
  | "tags"
  | "storage"
  | "activity"
  | "settings"
  | "admin"
  | "profile";

function kindForPath(path: string): SkeletonKind {
  switch (path) {
    case "/dashboard":
      return "files";
    case "/dashboard/recent":
      return "recent";
    case "/dashboard/favorites":
      return "favorites";
    case "/dashboard/shared":
      return "shared";
    case "/dashboard/links":
      return "links";
    case "/dashboard/archive":
      return "archive";
    case "/dashboard/trash":
      return "trash";
    case "/dashboard/tags":
      return "tags";
    case "/dashboard/storage":
      return "storage";
    case "/dashboard/activity":
      return "activity";
    case "/dashboard/settings":
      return "settings";
    case "/dashboard/admin":
      return "admin";
    case "/dashboard/profile":
      return "profile";
    default:
      return "files";
  }
}

function CrumbHeader({
  title,
  description,
  tabs,
  children,
}: {
  title: string;
  description?: string;
  tabs?: Array<{ value: string; label: string }>;
  children?: ReactNode;
}) {
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  return (
    <PageHeader
      className="-mx-6 -mt-6"
      breadcrumbs={
        <Breadcrumbs>
          <Breadcrumbs.Link href="/dashboard">{tBreadcrumbs("myFiles")}</Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Current>{title}</Breadcrumbs.Current>
        </Breadcrumbs>
      }
      title={title}
      description={description}
      tabs={tabs}
      activeTab={tabs?.[0]?.value}
    >
      {children}
    </PageHeader>
  );
}

function FilesToolbar() {
  const t = useTranslations("fileBrowser");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  return (
    <div className="flex items-center justify-between">
      <FileBreadcrumbs path={[{ id: null, name: tBreadcrumbs("myFiles") }]} onNavigate={() => undefined} />
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" icon={FolderPlusIcon} tabIndex={-1}>
          {t("newFolder")}
        </Button>
        <Button variant="primary" size="sm" icon={UploadSimpleIcon} tabIndex={-1}>
          {t("upload")}
        </Button>
        <Tabs
          variant="segmented"
          size="sm"
          tabs={[
            {
              value: "table",
              label: (
                <span className="flex items-center gap-1">
                  <ListBulletsIcon size={16} /> {t("viewList")}
                </span>
              ),
            },
            {
              value: "grid",
              label: (
                <span className="flex items-center gap-1">
                  <GridFourIcon size={16} /> {t("viewGrid")}
                </span>
              ),
            },
          ]}
          value="table"
        />
      </div>
    </div>
  );
}

function FilesContent() {
  const t = useTranslations("fileTable");
  return (
    <TableCardSkeleton
      ring
      columns={[" ", " ", t("name"), t("type"), t("owner"), t("modified"), t("size"), " "]}
    />
  );
}

function StorageContent() {
  const t = useTranslations("storagePage");
  const categories = [t("categoryImages"), t("categoryDocuments"), t("categoryVideos"), t("categoryOther")];
  const stats = [t("files"), t("folders"), t("totalSpace"), t("trash")];
  return (
    <>
      <Grid variant="4up" gap="base">
        {stats.map((label) => (
          <GridItem key={label}>
            <LayerCard>
              <LayerCard.Secondary>
                <Text as="span" variant="secondary">
                  {label}
                </Text>
              </LayerCard.Secondary>
              <LayerCard.Primary>
                <Pulse width={24} className="h-7" />
              </LayerCard.Primary>
            </LayerCard>
          </GridItem>
        ))}
      </Grid>
      <LayerCard className="flex flex-col gap-6 px-5 py-4">
        <div className="flex items-center justify-between">
          <Text as="span" variant="secondary">
            {t("usedStorage")}
          </Text>
          <Pulse width={28} />
        </div>
        <div className="h-2 w-full animate-pulse rounded-full bg-kumo-tint" />
        <div className="flex flex-col gap-4">
          {categories.map((label) => (
            <div key={label} className="flex items-start gap-2">
              <Pulse width={10} className="h-4 w-4" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <Text as="span" variant="secondary">
                    {label}
                  </Text>
                  <Pulse width={16} className="h-3" />
                </div>
                <div className="h-2 w-full animate-pulse rounded-full bg-kumo-tint" />
              </div>
            </div>
          ))}
        </div>
      </LayerCard>
    </>
  );
}

function SettingsContent() {
  const t = useTranslations("settingsPage");
  return (
    <>
      <Grid variant="2up" gap="base">
        <GridItem>
          <LayerCard>
            <LayerCard.Secondary>{t("createOrgTitle")}</LayerCard.Secondary>
            <LayerCard.Primary className="flex flex-col gap-4">
              <Text variant="secondary">{t("createOrgDescription")}</Text>
              <Toolbar size="sm">
                <Toolbar.InputGroup aria-label={t("newWorkspaceNamePlaceholder")}>
                  <InputGroup.Input placeholder={t("newWorkspaceNamePlaceholder")} readOnly />
                </Toolbar.InputGroup>
                <Toolbar.Button type="button" tabIndex={-1}>
                  {t("createGroup")}
                </Toolbar.Button>
              </Toolbar>
            </LayerCard.Primary>
          </LayerCard>
        </GridItem>
        <GridItem>
          <LayerCard>
            <LayerCard.Secondary>{t("subteamsTitle", { name: t("personalWorkspace") })}</LayerCard.Secondary>
            <LayerCard.Primary className="flex flex-col gap-4">
              <Text variant="secondary">{t("subteamsDescription")}</Text>
              <Toolbar size="sm">
                <Toolbar.InputGroup aria-label={t("newSubteamPlaceholder")}>
                  <InputGroup.Input placeholder={t("newSubteamPlaceholder")} readOnly />
                </Toolbar.InputGroup>
                <Toolbar.Button type="button" tabIndex={-1}>
                  {t("addSubteam")}
                </Toolbar.Button>
              </Toolbar>
            </LayerCard.Primary>
          </LayerCard>
        </GridItem>
      </Grid>
      <div className="grid gap-1.5">
        <Text as="h2" variant="heading3">
          {t("membersTitle", { name: t("personalWorkspace") })}
        </Text>
        <Text variant="secondary">{t("membersDescriptionWithOrg")}</Text>
      </div>
      <Toolbar size="sm">
        <Toolbar.InputGroup aria-label={t("inviteByEmail")}>
          <InputGroup.Input placeholder={t("collaboratorEmailPlaceholder")} readOnly />
        </Toolbar.InputGroup>
        <Toolbar.Button type="button" tabIndex={-1}>
          {t("inviteByEmail")}
        </Toolbar.Button>
      </Toolbar>
      <TableCardSkeleton columns={[t("memberColumn"), t("roleColumn"), t("actionColumn")]} rows={3} />
    </>
  );
}

function AdminContent({ includeSearch = true }: { includeSearch?: boolean }) {
  const t = useTranslations("adminPage");
  return (
    <div className="flex flex-col gap-6">
      {includeSearch ? (
        <Toolbar size="sm">
          <Toolbar.InputGroup aria-label={t("searchAria")}>
            <InputGroup.Addon>
              <MagnifyingGlassIcon size={16} />
            </InputGroup.Addon>
            <InputGroup.Input placeholder={t("searchPlaceholder")} readOnly />
          </Toolbar.InputGroup>
          <Toolbar.Button type="button" tabIndex={-1}>
            {t("search")}
          </Toolbar.Button>
        </Toolbar>
      ) : null}
      <TableCardSkeleton
        columns={[
          t("userColumn"),
          t("roleColumn"),
          t("statusColumn"),
          t("securityColumn"),
          t("signInColumn"),
          t("workspacesColumn"),
          t("lastSeenColumn"),
          t("registeredColumn"),
          t("actionsColumn"),
        ]}
      />
    </div>
  );
}

function ProfileContent() {
  const t = useTranslations("profilePage");
  return (
    <>
      <LayerCard>
        <LayerCard.Secondary className="flex items-center gap-3">
          <div className="size-16 animate-pulse rounded-full bg-kumo-tint" />
          <div className="flex flex-1 flex-col gap-2">
            <Pulse width={36} className="h-5" />
            <Pulse width={48} className="h-4" />
          </div>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          <Grid variant="2up" gap="base">
            <GridItem>
              <div className="flex flex-col gap-2">
                <Pulse width={22} className="h-3" />
                <div className="h-8 animate-pulse rounded-md bg-kumo-tint" />
              </div>
            </GridItem>
            <GridItem>
              <div className="flex flex-col gap-2">
                <Pulse width={22} className="h-3" />
                <div className="h-8 animate-pulse rounded-md bg-kumo-tint" />
              </div>
            </GridItem>
          </Grid>
        </LayerCard.Primary>
      </LayerCard>
      <div className="grid gap-1.5">
        <Text as="h2" variant="heading3">
          {t("passwordTitle")}
        </Text>
        <Text variant="secondary">{t("passwordDescription")}</Text>
      </div>
      <LayerCard className="px-5 py-4">
        <Grid variant="2up" gap="base">
          <GridItem>
            <div className="h-8 animate-pulse rounded-md bg-kumo-tint" />
          </GridItem>
          <GridItem>
            <div className="h-8 animate-pulse rounded-md bg-kumo-tint" />
          </GridItem>
        </Grid>
      </LayerCard>
      <div className="grid gap-1.5">
        <Text as="h2" variant="heading3">
          {t("activeSessionsTitle")}
        </Text>
        <Text variant="secondary">{t("activeSessionsDescription")}</Text>
      </div>
      <TableCardSkeleton columns={[t("deviceColumn"), t("ipAddressColumn"), t("lastActivityColumn"), " "]} rows={3} />
      <LayerCard>
        <LayerCard.Secondary>{t("twoFactorTitle")}</LayerCard.Secondary>
        <LayerCard.Primary className="flex flex-col gap-4">
          <Text variant="secondary">{t("twoFactorDescription")}</Text>
          <Pulse width={40} />
        </LayerCard.Primary>
      </LayerCard>
    </>
  );
}

function SkeletonBody({ kind, contentOnly }: { kind: SkeletonKind; contentOnly: boolean }) {
  const tFileTable = useTranslations("fileTable");
  const tRecent = useTranslations("recentPage");
  const tFavorites = useTranslations("favoritesPage");
  const tShared = useTranslations("sharedPage");
  const tLinks = useTranslations("linksPage");
  const tArchive = useTranslations("archivePage");
  const tTrash = useTranslations("trashPage");
  const tTags = useTranslations("tagsPage");
  const tActivity = useTranslations("activityPage");

  switch (kind) {
    case "files":
      return <FilesContent />;
    case "recent":
      return (
        <TableCardSkeleton
          columns={[tFileTable("name"), tRecent("locationColumn"), tRecent("modifiedColumn"), tRecent("sizeColumn"), " "]}
        />
      );
    case "favorites":
      return (
        <TableCardSkeleton
          columns={[
            " ",
            tFavorites("nameColumn"),
            tFavorites("locationColumn"),
            tFavorites("modifiedColumn"),
            tFavorites("sizeColumn"),
            " ",
          ]}
        />
      );
    case "shared":
      return (
        <TableCardSkeleton
          columns={[tFileTable("name"), tShared("sharedByColumn"), tFileTable("modified"), tFileTable("size")]}
        />
      );
    case "links":
      return (
        <TableCardSkeleton
          columns={[
            tLinks("nameColumn"),
            tLinks("typeColumn"),
            tLinks("createdColumn"),
            tLinks("expiresColumn"),
            tLinks("protectionColumn"),
            tLinks("actionsColumn"),
          ]}
        />
      );
    case "archive":
      return (
        <TableCardSkeleton
          columns={[tArchive("nameColumn"), tArchive("ownerColumn"), tArchive("archivedColumn"), " "]}
        />
      );
    case "trash":
      return (
        <TableCardSkeleton
          columns={[
            tTrash("nameColumn"),
            tTrash("typeColumn"),
            tTrash("deletedColumn"),
            tTrash("expiresColumn"),
            tTrash("actionsColumn"),
          ]}
        />
      );
    case "tags":
      return <TableCardSkeleton columns={[tTags("tagColumn"), tTags("itemsColumn"), tTags("actionsColumn")]} rows={4} />;
    case "storage":
      return <StorageContent />;
    case "activity":
      return (
        <TableCardSkeleton
          columns={[tActivity("columns.when"), tActivity("columns.actor"), tActivity("columns.action"), tActivity("columns.target")]}
        />
      );
    case "settings":
      return <SettingsContent />;
    case "admin":
      return <AdminContent includeSearch={!contentOnly} />;
    case "profile":
      return <ProfileContent />;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function SkeletonChrome({ kind, children }: { kind: SkeletonKind; children: ReactNode }) {
  const tRecent = useTranslations("recentPage");
  const tFavorites = useTranslations("favoritesPage");
  const tShared = useTranslations("sharedPage");
  const tLinks = useTranslations("linksPage");
  const tArchive = useTranslations("archivePage");
  const tTrash = useTranslations("trashPage");
  const tTags = useTranslations("tagsPage");
  const tStorage = useTranslations("storagePage");
  const tActivity = useTranslations("activityPage");
  const tSettings = useTranslations("settingsPage");
  const tAdmin = useTranslations("adminPage");
  const tProfile = useTranslations("profilePage");

  switch (kind) {
    case "files":
      return (
        <div className="flex flex-1 flex-col gap-4">
          <FilesToolbar />
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      );
    case "recent":
    case "favorites":
    case "shared":
    case "links":
    case "archive":
    case "trash":
    case "activity": {
      const copy =
        kind === "recent"
          ? { title: tRecent("title"), description: tRecent("description") }
          : kind === "favorites"
            ? { title: tFavorites("title"), description: tFavorites("description") }
            : kind === "shared"
              ? { title: tShared("breadcrumb"), description: tShared("description") }
              : kind === "links"
                ? { title: tLinks("title"), description: tLinks("description") }
                : kind === "archive"
                  ? { title: tArchive("title"), description: tArchive("description") }
                  : kind === "trash"
                    ? { title: tTrash("title"), description: tTrash("description") }
                    : { title: tActivity("title"), description: tActivity("description") };
      return (
        <div className="flex flex-1 flex-col">
          <CrumbHeader title={copy.title} description={copy.description} />
          <div className="flex flex-1 flex-col gap-6 pt-6">{children}</div>
        </div>
      );
    }
    case "tags":
      return (
        <div className="flex flex-1 flex-col">
          <CrumbHeader title={tTags("title")} description={tTags("description")}>
            <Button variant="primary" size="sm" icon={PlusIcon} tabIndex={-1}>
              {tTags("newTag")}
            </Button>
          </CrumbHeader>
          <div className="flex flex-1 flex-col gap-6 pt-6">{children}</div>
        </div>
      );
    case "storage":
      return (
        <div className="flex flex-1 flex-col">
          <CrumbHeader title={tStorage("title")} description={tStorage("description")} />
          <div className="flex flex-1 flex-col gap-6 pt-6">{children}</div>
        </div>
      );
    case "settings":
      return (
        <div className="flex flex-1 flex-col">
          <CrumbHeader
            title={tSettings("title")}
            description={tSettings("description")}
            tabs={[
              { value: "workspaces", label: tSettings("tabWorkspaces") },
              { value: "storage", label: tSettings("tabStorage") },
            ]}
          />
          <div className="flex flex-1 flex-col gap-6 pt-6">{children}</div>
        </div>
      );
    case "admin":
      return (
        <div className="flex flex-1 flex-col">
          <CrumbHeader
            title={tAdmin("title")}
            description={tAdmin("description")}
            tabs={[
              { value: "users", label: tAdmin("tabUsers") },
              { value: "workspaces", label: tAdmin("tabWorkspaces") },
              { value: "settings", label: tAdmin("tabSettings") },
            ]}
          />
          <div className="flex flex-1 flex-col gap-6 pt-6">{children}</div>
        </div>
      );
    case "profile":
      return (
        <div className="flex flex-1 flex-col">
          <CrumbHeader title={tProfile("title")} description={tProfile("description")} />
          <div className="flex flex-1 flex-col gap-6 pt-6">{children}</div>
        </div>
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function DashboardPageSkeleton({
  path,
  contentOnly = false,
}: {
  path?: string;
  contentOnly?: boolean;
}) {
  const { displayedPath } = useNavigation();
  const kind = kindForPath(path ?? displayedPath);
  const body = <SkeletonBody kind={kind} contentOnly={contentOnly} />;

  if (contentOnly) return body;
  return (
    <div className="pointer-events-none flex min-h-0 flex-1 flex-col">
      <SkeletonChrome kind={kind}>{body}</SkeletonChrome>
    </div>
  );
}
