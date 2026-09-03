"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Breadcrumbs, Button, DeleteResource, DropdownMenu, Empty, InputGroup, LayerCard, Table, Text, Toolbar, useKumoToastManager } from "@cloudflare/kumo";
import { Select } from "@cloudflare/kumo/components/select";
import { BuildingsIcon, DotsThreeIcon, ProhibitIcon, TrashIcon, UsersThreeIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { AdminSettingsPanel } from "@/components/shell/admin-settings-panel";
import { ConfirmDialog } from "@/components/kumo/confirm-dialog";
import { usePageReady } from "@/components/shell/navigation-provider";
import { UserAvatar } from "@/components/files/user-avatar";
import { authClient } from "@/lib/auth-client";
import { formatFileSize } from "@/lib/file-item";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  canBanUsers,
  canDeleteWorkspaces,
  canManageInstanceSettings,
  canSetUserRole,
  normalizeUserRole,
  roleMessageKey,
  type UserRole,
} from "@/lib/auth-permissions";

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  banReason: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  providers: string[];
  workspaceCount: number;
  activeSessionCount: number;
  lastSeenAt: string | null;
  createdAt: string;
};

type AdminWorkspaceRow = {
  id: string;
  name: string;
  type: string;
  ownerId: string | null;
  ownerName: string;
  ownerEmail: string;
  organizationName: string | null;
  memberCount: number;
  fileCount: number;
  folderCount: number;
  shareCount: number;
  storageBytes: number;
  quotaBytes: number;
  lastActivityAt: string | null;
  createdAt: string;
};

function roleBadgeVariant(role: UserRole): "primary" | "warning" | "info" | "neutral" {
  switch (role) {
    case "admin":
      return "primary";
    case "moderator":
      return "warning";
    case "support":
      return "info";
    case "user":
      return "neutral";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

export default function AdminPage() {
  const toasts = useKumoToastManager();
  const { data: session } = authClient.useSession();

  const [activeTab, setActiveTab] = useState<"users" | "workspaces" | "settings">("users");

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [userToBan, setUserToBan] = useState<AdminUserRow | null>(null);

  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<AdminWorkspaceRow | null>(null);

  const t = useTranslations("adminPage");
  const tToasts = useTranslations("adminPage.toasts");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();
  usePageReady(!usersLoading && !workspacesLoading);

  const actorRole = normalizeUserRole(session?.user?.role);
  const canEditRoles = canSetUserRole(actorRole);
  const canBan = canBanUsers(actorRole);
  const canRemoveWorkspace = canDeleteWorkspaces(actorRole);
  const showSettings = canManageInstanceSettings(actorRole);
  const adminCount = users.filter((userRow) => normalizeUserRole(userRow.role) === "admin").length;
  const moderatorCount = users.filter((userRow) => normalizeUserRole(userRow.role) === "moderator").length;
  const supportCount = users.filter((userRow) => normalizeUserRole(userRow.role) === "support").length;
  const filteredWorkspaces = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase();
    if (!query) return workspaces;
    return workspaces.filter((workspace) => {
      const haystack = [workspace.name, workspace.organizationName, workspace.ownerName, workspace.ownerEmail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [workspaceSearch, workspaces]);

  async function fetchUsers(searchValue?: string) {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchValue) params.set("q", searchValue);
      const res = await fetch(`/api/admin/users${params.size ? `?${params}` : ""}`);
      if (!res.ok) {
        toasts.add({ title: tToasts("genericError"), description: tToasts("loadUsersError") });
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      toasts.add({ title: tToasts("genericError"), description: tToasts("loadUsersError") });
    } finally {
      setUsersLoading(false);
    }
  }

  async function fetchWorkspaces() {
    setWorkspacesLoading(true);
    try {
      const res = await fetch("/api/admin/workspaces");
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces ?? []);
      } else {
        toasts.add({ title: tToasts("genericError"), description: tToasts("loadWorkspacesError") });
      }
    } catch (err) {
      console.error("Erreur chargement des workspaces :", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("loadWorkspacesError") });
    } finally {
      setWorkspacesLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchWorkspaces();
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers(search.trim() || undefined);
  }

  function providerLabel(provider: string): string {
    switch (provider) {
      case "credential":
      case "email":
        return t("providerEmail");
      case "github":
        return t("providerGithub");
      case "google":
        return t("providerGoogle");
      default:
        return provider;
    }
  }

  function roleToastLabel(role: UserRole): string {
    switch (role) {
      case "admin":
        return tToasts("administrator");
      case "moderator":
        return tToasts("moderator");
      case "support":
        return tToasts("support");
      case "user":
        return tToasts("standardUser");
      default: {
        const _exhaustive: never = role;
        return _exhaustive;
      }
    }
  }

  async function handleChangeRole(targetUser: AdminUserRow, nextValue: string | null) {
    if (!nextValue) return;
    const nextRole = normalizeUserRole(nextValue);
    if (nextRole === normalizeUserRole(targetUser.role)) return;
    setBusyUserId(targetUser.id);
    try {
      const { error } = await authClient.admin.setRole({ userId: targetUser.id, role: nextRole });
      if (error) {
        toasts.add({ title: tToasts("genericError"), description: error.message ?? tToasts("changeRoleError") });
        return;
      }
      toasts.add({
        title: tToasts("roleUpdatedTitle"),
        description: tToasts("roleUpdatedDescription", {
          email: targetUser.email,
          role: roleToastLabel(nextRole),
        }),
      });
      fetchUsers(search.trim() || undefined);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleToggleBan() {
    if (!userToBan) return;
    setBusyUserId(userToBan.id);
    try {
      const { error } = userToBan.banned
        ? await authClient.admin.unbanUser({ userId: userToBan.id })
        : await authClient.admin.banUser({ userId: userToBan.id, banReason: tToasts("banReason") });
      if (error) {
        toasts.add({ title: tToasts("genericError"), description: error.message ?? tToasts("actionImpossible") });
        return;
      }
      toasts.add({
        title: userToBan.banned ? tToasts("userUnbannedTitle") : tToasts("userBannedTitle"),
        description: userToBan.email,
      });
      setUserToBan(null);
      fetchUsers(search.trim() || undefined);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDeleteWorkspace() {
    if (!workspaceToDelete) return;

    setBusyWorkspaceId(workspaceToDelete.id);
    try {
      const res = await fetch(`/api/admin/workspaces?id=${workspaceToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({
          title: tToasts("workspaceDeletedTitle"),
          description: tToasts("workspaceDeletedDescription", { name: workspaceToDelete.name }),
        });
        setWorkspaceToDelete(null);
        fetchWorkspaces();
      } else {
        toasts.add({ title: tToasts("genericError"), description: tToasts("deleteWorkspaceError") });
      }
    } finally {
      setBusyWorkspaceId(null);
    }
  }

  const userColumns = [
    t("userColumn"),
    t("roleColumn"),
    t("statusColumn"),
    t("securityColumn"),
    t("signInColumn"),
    t("workspacesColumn"),
    t("lastSeenColumn"),
    t("registeredColumn"),
    t("actionsColumn"),
  ];

  const workspaceColumns = [
    t("workspaceColumn"),
    t("typeColumn"),
    t("ownerColumn"),
    t("membersColumn"),
    t("contentColumn"),
    t("storageColumn"),
    t("lastActivityColumn"),
    t("createdColumn"),
    t("actionsColumn"),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">{tBreadcrumbs("myFiles")}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>{t("title")}</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title={t("title")}
        description={t("description")}
        tabs={[
          { value: "users", label: t("tabUsers") },
          { value: "workspaces", label: t("tabWorkspaces") },
          ...(showSettings ? [{ value: "settings" as const, label: t("tabSettings") }] : []),
        ]}
        activeTab={activeTab}
        onValueChange={(val) => setActiveTab(val as "users" | "workspaces" | "settings")}
      />

      <div className="flex flex-1 flex-col gap-6 pt-6">
        {activeTab === "users" && (
          <div className="flex flex-col gap-6">
            <form onSubmit={handleSearchSubmit}>
              <Toolbar size="sm">
                <Toolbar.InputGroup aria-label={t("searchAria")}>
                  <InputGroup.Addon>
                    <MagnifyingGlassIcon size={16} />
                  </InputGroup.Addon>
                  <InputGroup.Input
                    placeholder={t("searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Toolbar.InputGroup>
                <Toolbar.Button type="submit">{t("search")}</Toolbar.Button>
              </Toolbar>
            </form>

            {!usersLoading && users.length > 0 ? (
              <Text variant="secondary">
                {t("usersSummary", {
                  count: users.length,
                  admins: adminCount,
                  moderators: moderatorCount,
                  support: supportCount,
                })}
              </Text>
            ) : null}

            {usersLoading ? (
              <TableCardSkeleton columns={userColumns} />
            ) : users.length === 0 ? (
              <LayerCard className="p-0">
                <Empty
                  size="sm"
                  icon={<UsersThreeIcon size={40} />}
                  title={t("noUsers")}
                  description={t("noUsersDescription")}
                />
              </LayerCard>
            ) : (
              <LayerCard className="overflow-x-auto p-0">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>{t("userColumn")}</Table.Head>
                      <Table.Head>{t("roleColumn")}</Table.Head>
                      <Table.Head>{t("statusColumn")}</Table.Head>
                      <Table.Head>{t("securityColumn")}</Table.Head>
                      <Table.Head>{t("signInColumn")}</Table.Head>
                      <Table.Head>{t("workspacesColumn")}</Table.Head>
                      <Table.Head>{t("lastSeenColumn")}</Table.Head>
                      <Table.Head>{t("registeredColumn")}</Table.Head>
                      <Table.Head className="text-right">{t("actionsColumn")}</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {users.map((userRow) => {
                      const isSelf = userRow.id === session?.user?.id;
                      const targetRole = normalizeUserRole(userRow.role);
                      const showBan =
                        canBan &&
                        !isSelf &&
                        (actorRole === "admin" || targetRole !== "admin");
                      return (
                        <Table.Row key={userRow.id}>
                          <Table.Cell>
                            <div className="flex items-start gap-2">
                              <span className="h-lh flex items-center">
                                <UserAvatar userId={userRow.id} name={userRow.name} size={24} />
                              </span>
                              <div className="grid gap-0.5">
                                <Text as="span" bold>{userRow.name}</Text>
                                <Text as="span" variant="secondary">{userRow.email}</Text>
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            {canEditRoles ? (
                              <Select
                                size="sm"
                                className="min-w-40"
                                aria-label={t("roleChangeAria", { email: userRow.email })}
                                value={normalizeUserRole(userRow.role)}
                                disabled={isSelf || busyUserId === userRow.id}
                                onValueChange={(value) => handleChangeRole(userRow, value)}
                                items={{
                                  admin: t("roleAdmin"),
                                  moderator: t("roleModerator"),
                                  support: t("roleSupport"),
                                  user: t("roleUser"),
                                }}
                              />
                            ) : (
                              <Badge variant={roleBadgeVariant(normalizeUserRole(userRow.role))}>
                                {t(roleMessageKey(normalizeUserRole(userRow.role)))}
                              </Badge>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <div className="grid gap-0.5">
                              {userRow.banned ? (
                                <Badge variant="error">{t("statusBanned")}</Badge>
                              ) : (
                                <Badge variant="success">{t("statusActive")}</Badge>
                              )}
                              {userRow.banned && userRow.banReason ? (
                                <Text as="span" variant="secondary">{userRow.banReason}</Text>
                              ) : null}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={userRow.emailVerified ? "success" : "neutral"}>
                                {userRow.emailVerified ? t("emailVerified") : t("emailUnverified")}
                              </Badge>
                              <Badge variant={userRow.twoFactorEnabled ? "success" : "neutral"}>
                                {userRow.twoFactorEnabled ? t("twoFactorOn") : t("twoFactorOff")}
                              </Badge>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            {userRow.providers.length === 0 ? (
                              <Text as="span" variant="secondary">{t("providerUnknown")}</Text>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {userRow.providers.map((provider) => (
                                  <Badge key={provider} variant="neutral">
                                    {providerLabel(provider)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </Table.Cell>
                          <Table.Cell>{t("workspaceCount", { count: userRow.workspaceCount })}</Table.Cell>
                          <Table.Cell>
                            <div className="grid gap-0.5">
                              <Text as="span">
                                {formatRelativeTime(userRow.lastSeenAt, locale, t("neverSeen"))}
                              </Text>
                              <Text as="span" variant="secondary">
                                {t("sessionsCount", { count: userRow.activeSessionCount })}
                              </Text>
                            </div>
                          </Table.Cell>
                          <Table.Cell>{formatDateTime(userRow.createdAt, locale)}</Table.Cell>
                          <Table.Cell className="text-right">
                            {showBan ? (
                              <DropdownMenu>
                                <DropdownMenu.Trigger>
                                  <Button
                                    variant="ghost"
                                    shape="square"
                                    size="sm"
                                    icon={DotsThreeIcon}
                                    disabled={busyUserId === userRow.id}
                                    aria-label={t("rowActionsAria", { email: userRow.email })}
                                  />
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content>
                                  <DropdownMenu.Item
                                    variant={userRow.banned ? undefined : "danger"}
                                    icon={ProhibitIcon}
                                    disabled={busyUserId === userRow.id}
                                    onClick={() => setUserToBan(userRow)}
                                  >
                                    {userRow.banned ? t("unban") : t("ban")}
                                  </DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu>
                            ) : null}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              </LayerCard>
            )}
          </div>
        )}

        {activeTab === "settings" && showSettings && <AdminSettingsPanel />}

        {activeTab === "workspaces" && (
          <div className="flex flex-col gap-6">
            <form
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <Toolbar size="sm">
                <Toolbar.InputGroup aria-label={t("workspaceSearchAria")}>
                  <InputGroup.Addon>
                    <MagnifyingGlassIcon size={16} />
                  </InputGroup.Addon>
                  <InputGroup.Input
                    placeholder={t("workspaceSearchPlaceholder")}
                    value={workspaceSearch}
                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                  />
                </Toolbar.InputGroup>
              </Toolbar>
            </form>

            {!workspacesLoading && workspaces.length > 0 ? (
              <Text variant="secondary">
                {t("workspacesSummary", { count: filteredWorkspaces.length, total: workspaces.length })}
              </Text>
            ) : null}

            {workspacesLoading ? (
              <TableCardSkeleton columns={workspaceColumns} />
            ) : filteredWorkspaces.length === 0 ? (
              <LayerCard className="p-0">
                <Empty
                  size="sm"
                  icon={<BuildingsIcon size={40} />}
                  title={workspaceSearch.trim() ? t("noWorkspaceMatch") : t("noWorkspaces")}
                  description={workspaceSearch.trim() ? t("noWorkspaceMatchDescription") : t("noWorkspacesDescription")}
                />
              </LayerCard>
            ) : (
              <LayerCard className="overflow-x-auto p-0">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>{t("workspaceColumn")}</Table.Head>
                      <Table.Head>{t("typeColumn")}</Table.Head>
                      <Table.Head>{t("ownerColumn")}</Table.Head>
                      <Table.Head>{t("membersColumn")}</Table.Head>
                      <Table.Head>{t("contentColumn")}</Table.Head>
                      <Table.Head>{t("storageColumn")}</Table.Head>
                      <Table.Head>{t("lastActivityColumn")}</Table.Head>
                      <Table.Head>{t("createdColumn")}</Table.Head>
                      <Table.Head className="text-right">{t("actionsColumn")}</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filteredWorkspaces.map((ws) => {
                      const usedPercent =
                        ws.quotaBytes > 0 ? Math.min(100, Math.round((ws.storageBytes / ws.quotaBytes) * 100)) : 0;
                      return (
                        <Table.Row key={ws.id}>
                          <Table.Cell>
                            <div className="grid gap-0.5">
                              <Text as="span" bold>{ws.name}</Text>
                              {ws.organizationName ? (
                                <Text as="span" variant="secondary">{ws.organizationName}</Text>
                              ) : null}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge variant="neutral">{ws.type === "personal" ? t("typePersonal") : t("typeTeam")}</Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex items-start gap-2">
                              <span className="h-lh flex items-center">
                                <UserAvatar userId={ws.ownerId} name={ws.ownerName || t("deletedUser")} size={24} />
                              </span>
                              <div className="grid gap-0.5">
                                <Text as="span">{ws.ownerName || t("deletedUser")}</Text>
                                {ws.ownerEmail ? (
                                  <Text as="span" variant="secondary">{ws.ownerEmail}</Text>
                                ) : null}
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="inline-flex items-start gap-1">
                              <span className="h-lh flex items-center">
                                <UsersThreeIcon size={14} />
                              </span>
                              {t("memberCount", { count: ws.memberCount })}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="grid gap-0.5">
                              <Text as="span">{t("fileCount", { count: ws.fileCount })}</Text>
                              <Text as="span" variant="secondary">
                                {t("contentSecondary", { folders: ws.folderCount, shares: ws.shareCount })}
                              </Text>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="grid gap-0.5">
                              <Text as="span">
                                {formatFileSize(ws.storageBytes)} / {formatFileSize(ws.quotaBytes)}
                              </Text>
                              <Text as="span" variant="secondary">
                                {t("storageUsedPercent", { percent: usedPercent })}
                              </Text>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            {formatRelativeTime(ws.lastActivityAt, locale, t("neverSeen"))}
                          </Table.Cell>
                          <Table.Cell>{formatDateTime(ws.createdAt, locale)}</Table.Cell>
                          <Table.Cell className="text-right">
                            {canRemoveWorkspace ? (
                              <DropdownMenu>
                                <DropdownMenu.Trigger>
                                  <Button
                                    variant="ghost"
                                    shape="square"
                                    size="sm"
                                    icon={DotsThreeIcon}
                                    disabled={busyWorkspaceId === ws.id}
                                    aria-label={t("workspaceRowActionsAria", { name: ws.name })}
                                  />
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content>
                                  <DropdownMenu.Item
                                    variant="danger"
                                    icon={TrashIcon}
                                    disabled={busyWorkspaceId === ws.id}
                                    onClick={() => setWorkspaceToDelete(ws)}
                                  >
                                    {t("delete")}
                                  </DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu>
                            ) : null}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              </LayerCard>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={userToBan !== null}
        onOpenChange={(open) => {
          if (!open && busyUserId === null) setUserToBan(null);
        }}
        title={userToBan?.banned ? t("unbanTitle") : t("banTitle")}
        description={
          userToBan?.banned
            ? t("unbanDescription", { email: userToBan.email })
            : t("banDescription", { email: userToBan?.email ?? "" })
        }
        confirmLabel={userToBan?.banned ? t("unbanConfirm") : t("banConfirm")}
        onConfirm={handleToggleBan}
        isConfirming={busyUserId !== null}
        variant={userToBan?.banned ? "primary" : "destructive"}
      />

      <DeleteResource
        open={workspaceToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setWorkspaceToDelete(null);
        }}
        resourceType={t("workspaceResourceType")}
        resourceName={workspaceToDelete?.name ?? ""}
        onDelete={handleDeleteWorkspace}
        isDeleting={busyWorkspaceId !== null}
        deleteButtonText={t("delete")}
      />
    </div>
  );
}
