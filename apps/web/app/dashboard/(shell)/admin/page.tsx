"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Breadcrumbs, Button, DeleteResource, DropdownMenu, Empty, InputGroup, LayerCard, Table, Text, Toolbar, useKumoToastManager } from "@cloudflare/kumo";
import { BuildingsIcon, DotsThreeIcon, ProhibitIcon, ShieldCheckIcon, TrashIcon, UsersThreeIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { authClient } from "@/lib/auth-client";
import { formatFileSize } from "@/lib/file-item";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  createdAt: string;
};

type AdminWorkspace = {
  id: string;
  name: string;
  type: string;
  ownerName: string;
  ownerEmail: string;
  organizationName: string | null;
  memberCount: number;
  storageBytes: number;
  createdAt: string;
};

export default function AdminPage() {
  const toasts = useKumoToastManager();
  const { data: session } = authClient.useSession();

  const [activeTab, setActiveTab] = useState<"users" | "workspaces">("users");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<AdminWorkspace | null>(null);

  const t = useTranslations("adminPage");
  const tToasts = useTranslations("adminPage.toasts");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();
  usePageReady(!usersLoading && !workspacesLoading);

  async function fetchUsers(searchValue?: string) {
    setUsersLoading(true);
    try {
      const { data, error } = await authClient.admin.listUsers({
        query: {
          limit: 50,
          ...(searchValue ? { searchValue, searchField: "email" as const, searchOperator: "contains" as const } : {}),
        },
      });
      if (error) {
        toasts.add({ title: tToasts("genericError"), description: error.message ?? tToasts("loadUsersError") });
        return;
      }
      const mapped: AdminUser[] = (data?.users ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role ?? null,
        banned: u.banned ?? null,
        createdAt: new Date(u.createdAt).toISOString(),
      }));
      setUsers(mapped);
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
      }
    } catch (err) {
      console.error("Erreur chargement des workspaces :", err);
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

  async function handleToggleRole(targetUser: AdminUser) {
    const nextRole = targetUser.role === "admin" ? "user" : "admin";
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
          role: nextRole === "admin" ? tToasts("administrator") : tToasts("standardUser"),
        }),
      });
      fetchUsers(search.trim() || undefined);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleToggleBan(targetUser: AdminUser) {
    setBusyUserId(targetUser.id);
    try {
      const { error } = targetUser.banned
        ? await authClient.admin.unbanUser({ userId: targetUser.id })
        : await authClient.admin.banUser({ userId: targetUser.id, banReason: tToasts("banReason") });
      if (error) {
        toasts.add({ title: tToasts("genericError"), description: error.message ?? tToasts("actionImpossible") });
        return;
      }
      toasts.add({
        title: targetUser.banned ? tToasts("userUnbannedTitle") : tToasts("userBannedTitle"),
        description: targetUser.email,
      });
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
        ]}
        activeTab={activeTab}
        onValueChange={(val) => setActiveTab(val as "users" | "workspaces")}
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

            {usersLoading ? (
              <TableCardSkeleton
                columns={[t("userColumn"), t("roleColumn"), t("statusColumn"), t("registeredColumn"), t("actionsColumn")]}
              />
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
              <LayerCard className="p-0">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>{t("userColumn")}</Table.Head>
                      <Table.Head>{t("roleColumn")}</Table.Head>
                      <Table.Head>{t("statusColumn")}</Table.Head>
                      <Table.Head>{t("registeredColumn")}</Table.Head>
                      <Table.Head className="text-right">{t("actionsColumn")}</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {users.map((u) => {
                      const isSelf = u.id === session?.user?.id;
                      return (
                        <Table.Row key={u.id}>
                          <Table.Cell>
                            <div className="grid gap-0.5">
                              <Text as="span" bold>{u.name}</Text>
                              <Text as="span" variant="secondary">{u.email}</Text>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge variant={u.role === "admin" ? "primary" : "neutral"}>
                              {u.role === "admin" ? t("roleAdmin") : t("roleUser")}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell>
                            {u.banned ? <Badge variant="error">{t("statusBanned")}</Badge> : <Badge variant="success">{t("statusActive")}</Badge>}
                          </Table.Cell>
                          <Table.Cell>{new Date(u.createdAt).toLocaleDateString(locale)}</Table.Cell>
                          <Table.Cell className="text-right">
                            <DropdownMenu>
                              <DropdownMenu.Trigger>
                                <Button
                                  variant="ghost"
                                  shape="square"
                                  size="sm"
                                  icon={DotsThreeIcon}
                                  disabled={isSelf || busyUserId === u.id}
                                  aria-label={t("rowActionsAria", { email: u.email })}
                                />
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content>
                                <DropdownMenu.Item
                                  icon={ShieldCheckIcon}
                                  disabled={isSelf || busyUserId === u.id}
                                  onClick={() => handleToggleRole(u)}
                                >
                                  {u.role === "admin" ? t("demote") : t("promote")}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  variant={u.banned ? undefined : "danger"}
                                  icon={ProhibitIcon}
                                  disabled={isSelf || busyUserId === u.id}
                                  onClick={() => handleToggleBan(u)}
                                >
                                  {u.banned ? t("unban") : t("ban")}
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu>
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

        {activeTab === "workspaces" && (
          <div className="flex flex-col gap-6">
            {workspacesLoading ? (
              <TableCardSkeleton
                columns={[
                  t("workspaceColumn"),
                  t("typeColumn"),
                  t("ownerColumn"),
                  t("membersColumn"),
                  t("storageColumn"),
                  t("createdColumn"),
                  t("actionsColumn"),
                ]}
              />
            ) : workspaces.length === 0 ? (
              <LayerCard className="p-0">
                <Empty
                  size="sm"
                  icon={<BuildingsIcon size={40} />}
                  title={t("noWorkspaces")}
                  description={t("noWorkspacesDescription")}
                />
              </LayerCard>
            ) : (
              <LayerCard className="p-0">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>{t("workspaceColumn")}</Table.Head>
                      <Table.Head>{t("typeColumn")}</Table.Head>
                      <Table.Head>{t("ownerColumn")}</Table.Head>
                      <Table.Head>{t("membersColumn")}</Table.Head>
                      <Table.Head>{t("storageColumn")}</Table.Head>
                      <Table.Head>{t("createdColumn")}</Table.Head>
                      <Table.Head className="text-right">{t("actionsColumn")}</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {workspaces.map((ws) => (
                      <Table.Row key={ws.id}>
                        <Table.Cell>
                          <div className="grid gap-0.5">
                            <Text as="span" bold>{ws.name}</Text>
                            {ws.organizationName && <Text as="span" variant="secondary">{ws.organizationName}</Text>}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant="neutral">{ws.type === "personal" ? t("typePersonal") : t("typeTeam")}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="grid gap-0.5">
                            <Text as="span">{ws.ownerName}</Text>
                            <Text as="span" variant="secondary">{ws.ownerEmail}</Text>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-lh flex items-center">
                              <UsersThreeIcon size={14} />
                            </span>
                            {ws.memberCount}
                          </span>
                        </Table.Cell>
                        <Table.Cell>{formatFileSize(ws.storageBytes)}</Table.Cell>
                        <Table.Cell>{new Date(ws.createdAt).toLocaleDateString(locale)}</Table.Cell>
                        <Table.Cell className="text-right">
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
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </LayerCard>
            )}
          </div>
        )}
      </div>

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
