"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Breadcrumbs, Button, Input, LayerCard, Loader, SkeletonLine, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { UsersThreeIcon, BuildingsIcon, ShieldCheckIcon, ProhibitIcon, TrashIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";
import { authClient } from "@/lib/auth-client";
import { formatFileSize } from "@/lib/mock-files";

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

  const t = useTranslations("adminPage");
  const tToasts = useTranslations("adminPage.toasts");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();

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

  async function handleDeleteWorkspace(ws: AdminWorkspace) {
    if (!confirm(t("deleteWorkspaceConfirm", { name: ws.name }))) return;

    setBusyWorkspaceId(ws.id);
    try {
      const res = await fetch(`/api/admin/workspaces?id=${ws.id}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({ title: tToasts("workspaceDeletedTitle"), description: tToasts("workspaceDeletedDescription", { name: ws.name }) });
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
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSearchSubmit} className="flex max-w-sm gap-2">
              <Input
                size="sm"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <Button variant="secondary" size="sm" type="submit" icon={MagnifyingGlassIcon}>
                {t("search")}
              </Button>
            </form>

            {usersLoading ? (
              <ClientOnly fallback={<div className="min-h-40 animate-pulse rounded-lg border border-kumo-line bg-kumo-base" />}>
                <div className="flex flex-col gap-3 rounded-lg border border-kumo-line bg-kumo-base p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonLine key={i} minWidth={60} maxWidth={80} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                  ))}
                </div>
              </ClientOnly>
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
                            <div className="flex flex-col">
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
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={ShieldCheckIcon}
                                disabled={isSelf || busyUserId === u.id}
                                onClick={() => handleToggleRole(u)}
                              >
                                {u.role === "admin" ? t("demote") : t("promote")}
                              </Button>
                              <Button
                                variant={u.banned ? "secondary" : "destructive"}
                                size="sm"
                                icon={ProhibitIcon}
                                disabled={isSelf || busyUserId === u.id}
                                onClick={() => handleToggleBan(u)}
                              >
                                {busyUserId === u.id ? <Loader size="sm" /> : u.banned ? t("unban") : t("ban")}
                              </Button>
                            </div>
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
          <div className="flex flex-col gap-4">
            {workspacesLoading ? (
              <ClientOnly fallback={<div className="min-h-40 animate-pulse rounded-lg border border-kumo-line bg-kumo-base" />}>
                <div className="flex flex-col gap-3 rounded-lg border border-kumo-line bg-kumo-base p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonLine key={i} minWidth={60} maxWidth={80} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                  ))}
                </div>
              </ClientOnly>
            ) : workspaces.length === 0 ? (
              <LayerCard className="flex flex-col items-center justify-center p-12 text-center">
                <BuildingsIcon size={48} className="text-kumo-subtle mb-3" />
                <Text as="p" variant="heading3">{t("noWorkspaces")}</Text>
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
                          <div className="flex flex-col">
                            <Text as="span" bold>{ws.name}</Text>
                            {ws.organizationName && <Text as="span" variant="secondary">{ws.organizationName}</Text>}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant="neutral">{ws.type === "personal" ? t("typePersonal") : t("typeTeam")}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-col">
                            <Text as="span">{ws.ownerName}</Text>
                            <Text as="span" variant="secondary">{ws.ownerEmail}</Text>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="inline-flex items-center gap-1">
                            <UsersThreeIcon size={14} /> {ws.memberCount}
                          </span>
                        </Table.Cell>
                        <Table.Cell>{formatFileSize(ws.storageBytes)}</Table.Cell>
                        <Table.Cell>{new Date(ws.createdAt).toLocaleDateString(locale)}</Table.Cell>
                        <Table.Cell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            icon={TrashIcon}
                            disabled={busyWorkspaceId === ws.id}
                            onClick={() => handleDeleteWorkspace(ws)}
                          >
                            {t("delete")}
                          </Button>
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
    </div>
  );
}
