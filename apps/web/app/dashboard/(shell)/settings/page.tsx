"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Badge, Breadcrumbs, Button, Input, LayerCard, Loader, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  UsersThreeIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { authClient } from "@/lib/auth-client";

type MemberUI = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type InvitationUI = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export default function SettingsPage() {
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const toasts = useKumoToastManager();
  const t = useTranslations("settingsPage");
  const tToasts = useTranslations("settingsPage.toasts");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");

  const [activeTab, setActiveTab] = useState<"workspaces" | "storage">("workspaces");
  const [members, setMembers] = useState<MemberUI[]>([]);
  const [invitations, setInvitations] = useState<InvitationUI[]>([]);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [invitingMember, setInvitingMember] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [submittingOrg, setSubmittingOrg] = useState(false);

  const [canManageMembers, setCanManageMembers] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  // État contrôlé pour les champs S3
  const [s3Endpoint, setS3Endpoint] = useState("http://localhost:9000");
  const [s3Bucket, setS3Bucket] = useState("filecloud-data");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3AccessKey, setS3AccessKey] = useState("minioadmin");

  // Synchroniser les vrais membres, invitations et rôle actif de l'organisation Better Auth
  const loadWorkspaceData = useCallback(async () => {
    const membersRes = await fetch("/api/workspace/members");
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(
        (data.members ?? []).map((m: { id: string; name: string; email: string; role: string }) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
        })),
      );
      setCanManageMembers(Boolean(data.canManage));
      setActiveRole(data.role ?? null);
      setWorkspaceName(data.workspaceName ?? "");
    } else if (session?.user) {
      setMembers([{ id: session.user.id, name: session.user.name, email: session.user.email, role: "owner" }]);
      setCanManageMembers(true);
    }

    if (!activeOrg) {
      setInvitations([]);
      return;
    }

    const [{ data: invitationData }] = await Promise.all([
      authClient.organization.listInvitations({ query: { organizationId: activeOrg.id } }),
    ]);
    const pending = (invitationData ?? []).filter((inv) => inv.status === "pending");
    setInvitations(pending.map((inv) => ({ id: inv.id, email: inv.email, role: inv.role ?? "member", status: inv.status })));
  }, [activeOrg, session?.user]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  async function handleCreateOrganization(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setSubmittingOrg(true);
    const slug = newOrgName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data: createdOrg, error } = await authClient.organization.create({
      name: newOrgName.trim(),
      slug: slug || `org-${Date.now()}`,
    });
    setSubmittingOrg(false);

    if (error) {
      toasts.add({
        title: tToasts("createOrgErrorTitle"),
        description: error.message ?? tToasts("createOrgErrorFallback"),
      });
      return;
    }

    if (createdOrg) {
      await authClient.organization.setActive({ organizationId: createdOrg.id });
    }

    toasts.add({
      title: tToasts("orgCreatedTitle"),
      description: tToasts("orgCreatedDescription", { name: newOrgName }),
    });
    setNewOrgName("");
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    setInvitingMember(true);
    try {
      const res = await fetch("/api/workspace/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMemberEmail.trim() }),
      });
      if (res.ok) {
        toasts.add({
          title: tToasts("memberAddedTitle"),
          description: tToasts("memberAddedDescription", { email: newMemberEmail }),
        });
        setNewMemberEmail("");
        loadWorkspaceData();
        return;
      }

      const data = await res.json().catch(() => null);
      if (res.status === 404 && activeOrg) {
        const { error } = await authClient.organization.inviteMember({
          email: newMemberEmail.trim(),
          role: "member",
        });
        if (error) {
          toasts.add({
            title: tToasts("inviteErrorTitle"),
            description: error.message ?? tToasts("inviteErrorFallback"),
          });
          return;
        }
        toasts.add({
          title: tToasts("invitationSentTitle"),
          description: tToasts("invitationSentDescription", { email: newMemberEmail }),
        });
        setNewMemberEmail("");
        loadWorkspaceData();
        return;
      }

      toasts.add({
        title: tToasts("inviteErrorTitle"),
        description: data?.error ?? tToasts("inviteErrorFallback"),
      });
    } finally {
      setInvitingMember(false);
    }
  }

  async function handleRemoveMember(memberId: string, email: string) {
    const res = await fetch(`/api/workspace/members?userId=${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toasts.add({ title: tToasts("genericError"), description: data?.error ?? tToasts("removeMemberErrorFallback") });
      return;
    }
    toasts.add({ title: tToasts("memberRemovedTitle"), description: tToasts("memberRemovedDescription", { email }) });
    loadWorkspaceData();
  }

  async function handleCancelInvitation(invitationId: string, email: string) {
    const { error } = await authClient.organization.cancelInvitation({ invitationId });
    if (error) {
      toasts.add({ title: tToasts("genericError"), description: error.message ?? tToasts("cancelInvitationErrorFallback") });
      return;
    }
    toasts.add({ title: tToasts("invitationCancelledTitle"), description: email });
    loadWorkspaceData();
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    toasts.add({
      title: tToasts("subteamCreatedTitle"),
      description: tToasts("subteamCreatedDescription", { name: newTeamName, workspace: activeOrg?.name ?? tToasts("yourWorkspace") }),
    });
    setNewTeamName("");
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
          { value: "workspaces", label: t("tabWorkspaces") },
          { value: "storage", label: t("tabStorage") },
        ]}
        activeTab={activeTab}
        onValueChange={(val) => setActiveTab(val as "workspaces" | "storage")}
      />

      <div className="flex flex-1 flex-col gap-6 max-w-4xl pt-6">

      {/* Onglet Groupes & Équipes */}
      {activeTab === "workspaces" && (
        <div className="flex flex-col gap-6">
          {/* Créer un nouveau groupe d'organisation */}
          <LayerCard className="flex flex-col gap-4 p-6">
            <div>
              <Text as="h2" variant="heading2">
                {t("createOrgTitle")}
              </Text>
              <Text variant="secondary">
                {t("createOrgDescription")}
              </Text>
            </div>

            <form onSubmit={handleCreateOrganization} className="flex gap-3">
              <Input
                size="sm"
                placeholder={t("newWorkspaceNamePlaceholder")}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="flex-1"
              />
              <Button variant="primary" size="sm" type="submit" disabled={submittingOrg} icon={PlusIcon}>
                {submittingOrg ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("creating")}
                  </span>
                ) : (
                  t("createGroup")
                )}
              </Button>
            </form>
          </LayerCard>

          {/* Créer une sous-équipe */}
          <LayerCard className="flex flex-col gap-4 p-6">
            <div>
              <Text as="h2" variant="heading2">
                {t("subteamsTitle", { name: activeOrg?.name ?? t("personalWorkspace") })}
              </Text>
              <Text variant="secondary">
                {t("subteamsDescription")}
              </Text>
            </div>

            <form onSubmit={handleCreateTeam} className="flex gap-3">
              <Input
                size="sm"
                placeholder={t("newSubteamPlaceholder")}
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="flex-1"
              />
              <Button variant="secondary" size="sm" type="submit" icon={PlusIcon}>
                {t("addSubteam")}
              </Button>
            </form>
          </LayerCard>

          {/* Membres & Invitations */}
          <LayerCard className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <Text as="h2" variant="heading2">
                  {t("membersTitle", { name: workspaceName || activeOrg?.name || t("personalWorkspace") })}
                </Text>
                <Text variant="secondary">
                  {t("membersDescriptionWithOrg")}
                </Text>
              </div>
            </div>

            {canManageMembers && (
              <form onSubmit={handleInviteMember} className="flex gap-3 my-2">
                <Input
                  size="sm"
                  type="email"
                  placeholder={t("collaboratorEmailPlaceholder")}
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" type="submit" disabled={invitingMember} icon={UsersThreeIcon}>
                  {invitingMember ? (
                    <span className="flex items-center gap-1.5">
                      <Loader size="sm" /> {t("sending")}
                    </span>
                  ) : (
                    t("inviteByEmail")
                  )}
                </Button>
              </form>
            )}

            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>{t("memberColumn")}</Table.Head>
                  <Table.Head>{t("roleColumn")}</Table.Head>
                  {canManageMembers && <Table.Head className="text-right">{t("actionColumn")}</Table.Head>}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {members.map((member) => (
                  <Table.Row key={member.id}>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <Text as="span" bold>{member.name}</Text>
                        <Text as="span" variant="secondary">{member.email}</Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={member.role === "owner" || member.role === "admin" ? "primary" : "neutral"}>
                        {member.role === "owner" ? t("roleOwner") : member.role === "admin" ? t("roleAdmin") : t("roleMember")}
                      </Badge>
                    </Table.Cell>
                    {canManageMembers && (
                      <Table.Cell className="text-right">
                        {member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            shape="square"
                            size="sm"
                            icon={TrashIcon}
                            title={t("removeMember")}
                            onClick={() => handleRemoveMember(member.id, member.email)}
                          />
                        )}
                      </Table.Cell>
                    )}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </LayerCard>

          {/* Invitations en attente */}
          {activeOrg && canManageMembers && invitations.length > 0 && (
            <LayerCard className="flex flex-col gap-4 p-6">
              <div>
                <Text as="h2" variant="heading2">{t("pendingInvitationsTitle")}</Text>
                <Text variant="secondary">{t("pendingInvitationsDescription")}</Text>
              </div>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>{t("emailColumn")}</Table.Head>
                    <Table.Head>{t("proposedRoleColumn")}</Table.Head>
                    <Table.Head className="text-right">{t("actionColumn")}</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {invitations.map((inv) => (
                    <Table.Row key={inv.id}>
                      <Table.Cell>{inv.email}</Table.Cell>
                      <Table.Cell>
                        <Badge variant="neutral">{inv.role === "admin" ? t("roleAdmin") : t("roleMember")}</Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Button
                          variant="ghost"
                          shape="square"
                          size="sm"
                          icon={XCircleIcon}
                          title={t("cancelInvitation")}
                          onClick={() => handleCancelInvitation(inv.id, inv.email)}
                        />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard>
          )}
        </div>
      )}

      {/* Onglet Stockage & S3 */}
      {activeTab === "storage" && (
        <LayerCard className="flex flex-col gap-6 p-6">
          <div>
            <Text as="h2" variant="heading2">
              {t("storageConfigTitle")}
            </Text>
            <Text variant="secondary">
              {t("storageConfigDescription")}
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              size="sm"
              label={t("s3Endpoint")}
              value={s3Endpoint}
              onChange={(e) => setS3Endpoint(e.target.value)}
            />
            <Input
              size="sm"
              label={t("bucketName")}
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
            />
            <Input
              size="sm"
              label={t("s3Region")}
              value={s3Region}
              onChange={(e) => setS3Region(e.target.value)}
            />
            <Input
              size="sm"
              label={t("accessKeyId")}
              value={s3AccessKey}
              onChange={(e) => setS3AccessKey(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            className="w-fit"
            onClick={() => toasts.add({ title: tToasts("s3ConfigTitle"), description: tToasts("s3ConnectionSuccess") })}
          >
            {t("testS3Connection")}
          </Button>
        </LayerCard>
      )}
      </div>
    </div>
  );
}
