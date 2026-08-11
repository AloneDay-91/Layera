"use client";

import { useEffect, useState } from "react";
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
        toasts.add({ title: "Erreur", description: error.message ?? "Impossible de charger les utilisateurs." });
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
        toasts.add({ title: "Erreur", description: error.message ?? "Impossible de changer le rôle." });
        return;
      }
      toasts.add({
        title: "Rôle mis à jour",
        description: `${targetUser.email} est maintenant ${nextRole === "admin" ? "administrateur" : "utilisateur standard"}.`,
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
        : await authClient.admin.banUser({ userId: targetUser.id, banReason: "Banni par un administrateur" });
      if (error) {
        toasts.add({ title: "Erreur", description: error.message ?? "Action impossible." });
        return;
      }
      toasts.add({
        title: targetUser.banned ? "Utilisateur débanni" : "Utilisateur banni",
        description: targetUser.email,
      });
      fetchUsers(search.trim() || undefined);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDeleteWorkspace(ws: AdminWorkspace) {
    if (!confirm(`Supprimer définitivement le workspace "${ws.name}" et tout son contenu ?`)) return;

    setBusyWorkspaceId(ws.id);
    try {
      const res = await fetch(`/api/admin/workspaces?id=${ws.id}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({ title: "Workspace supprimé", description: `"${ws.name}" et son contenu ont été supprimés.` });
        fetchWorkspaces();
      } else {
        toasts.add({ title: "Erreur", description: "Impossible de supprimer ce workspace." });
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
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Administration</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Administration"
        description="Gérez les utilisateurs et les workspaces de la plateforme. Réservé aux administrateurs."
        tabs={[
          { value: "users", label: "Utilisateurs" },
          { value: "workspaces", label: "Workspaces" },
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
                placeholder="Rechercher par email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <Button variant="secondary" size="sm" type="submit" icon={MagnifyingGlassIcon}>
                Rechercher
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
                      <Table.Head>Utilisateur</Table.Head>
                      <Table.Head>Rôle</Table.Head>
                      <Table.Head>Statut</Table.Head>
                      <Table.Head>Inscrit le</Table.Head>
                      <Table.Head className="text-right">Actions</Table.Head>
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
                              {u.role === "admin" ? "Administrateur" : "Utilisateur"}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell>
                            {u.banned ? <Badge variant="error">Banni</Badge> : <Badge variant="success">Actif</Badge>}
                          </Table.Cell>
                          <Table.Cell>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</Table.Cell>
                          <Table.Cell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={ShieldCheckIcon}
                                disabled={isSelf || busyUserId === u.id}
                                onClick={() => handleToggleRole(u)}
                              >
                                {u.role === "admin" ? "Rétrograder" : "Promouvoir"}
                              </Button>
                              <Button
                                variant={u.banned ? "secondary" : "destructive"}
                                size="sm"
                                icon={ProhibitIcon}
                                disabled={isSelf || busyUserId === u.id}
                                onClick={() => handleToggleBan(u)}
                              >
                                {busyUserId === u.id ? <Loader size="sm" /> : u.banned ? "Débannir" : "Bannir"}
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
                <Text as="p" variant="heading3">Aucun workspace</Text>
              </LayerCard>
            ) : (
              <LayerCard className="p-0">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Workspace</Table.Head>
                      <Table.Head>Type</Table.Head>
                      <Table.Head>Propriétaire</Table.Head>
                      <Table.Head>Membres</Table.Head>
                      <Table.Head>Stockage</Table.Head>
                      <Table.Head>Créé le</Table.Head>
                      <Table.Head className="text-right">Actions</Table.Head>
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
                          <Badge variant="neutral">{ws.type === "personal" ? "Personnel" : "Équipe"}</Badge>
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
                        <Table.Cell>{new Date(ws.createdAt).toLocaleDateString("fr-FR")}</Table.Cell>
                        <Table.Cell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            icon={TrashIcon}
                            disabled={busyWorkspaceId === ws.id}
                            onClick={() => handleDeleteWorkspace(ws)}
                          >
                            Supprimer
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
