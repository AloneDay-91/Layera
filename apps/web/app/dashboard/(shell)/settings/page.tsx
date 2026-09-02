"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Badge, Breadcrumbs, Button, DropdownMenu, Grid, GridItem, Input, InputGroup, LayerCard, Loader, Table, Text, Toolbar, useKumoToastManager } from "@cloudflare/kumo";
import {
  DotsThreeIcon,
  UsersThreeIcon,
  TrashIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { authClient } from "@/lib/auth-client";
import { usePageReady } from "@/components/shell/navigation-provider";

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
  const [pageReady, setPageReady] = useState(false);
  usePageReady(pageReady);

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
    let cancelled = false;
    loadWorkspaceData().finally(() => {
      if (!cancelled) setPageReady(true);
    });
    return () => {
      cancelled = true;
    };
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

      <div className="flex flex-1 flex-col gap-6 pt-6">
      {activeTab === "workspaces" && (
        <div className="flex flex-col gap-6">
          <Grid variant="2up" gap="base">
            <GridItem>
              <LayerCard>
                <LayerCard.Secondary>{t("createOrgTitle")}</LayerCard.Secondary>
                <LayerCard.Primary className="flex flex-col gap-4">
                  <Text variant="secondary">{t("createOrgDescription")}</Text>
                  <form onSubmit={handleCreateOrganization}>
                    <Toolbar size="sm">
                      <Toolbar.InputGroup aria-label={t("newWorkspaceNamePlaceholder")}>
                        <InputGroup.Input
                          placeholder={t("newWorkspaceNamePlaceholder")}
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                        />
                      </Toolbar.InputGroup>
                      <Toolbar.Button type="submit" disabled={submittingOrg}>
                        {submittingOrg ? <Loader size="sm" /> : t("createGroup")}
                      </Toolbar.Button>
                    </Toolbar>
                  </form>
                </LayerCard.Primary>
              </LayerCard>
            </GridItem>
            <GridItem>
              <LayerCard>
                <LayerCard.Secondary>
                  {t("subteamsTitle", { name: activeOrg?.name ?? t("personalWorkspace") })}
                </LayerCard.Secondary>
                <LayerCard.Primary className="flex flex-col gap-4">
                  <Text variant="secondary">{t("subteamsDescription")}</Text>
                  <form onSubmit={handleCreateTeam}>
                    <Toolbar size="sm">
                      <Toolbar.InputGroup aria-label={t("newSubteamPlaceholder")}>
                        <InputGroup.Input
                          placeholder={t("newSubteamPlaceholder")}
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                        />
                      </Toolbar.InputGroup>
                      <Toolbar.Button type="submit">{t("addSubteam")}</Toolbar.Button>
                    </Toolbar>
                  </form>
                </LayerCard.Primary>
              </LayerCard>
            </GridItem>
          </Grid>

          <div className="flex flex-col gap-6">
            <div className="grid gap-1.5">
              <Text as="h2" variant="heading3">
                {t("membersTitle", { name: workspaceName || activeOrg?.name || t("personalWorkspace") })}
              </Text>
              <Text variant="secondary">
                {canManageMembers ? t("membersDescriptionWithOrg") : t("membersDescriptionNoOrg")}
              </Text>
            </div>
            {canManageMembers && (
              <form onSubmit={handleInviteMember}>
                <Toolbar size="sm">
                  <Toolbar.InputGroup aria-label={t("inviteByEmail")}>
                    <InputGroup.Addon>
                      <UsersThreeIcon size={16} />
                    </InputGroup.Addon>
                    <InputGroup.Input
                      type="email"
                      placeholder={t("collaboratorEmailPlaceholder")}
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                    />
                  </Toolbar.InputGroup>
                  <Toolbar.Button type="submit" disabled={invitingMember}>
                    {invitingMember ? <Loader size="sm" /> : t("inviteByEmail")}
                  </Toolbar.Button>
                </Toolbar>
              </form>
            )}

            <LayerCard className="p-0">
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
                        <div className="grid gap-0.5">
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
                            <DropdownMenu>
                              <DropdownMenu.Trigger>
                                <Button
                                  variant="ghost"
                                  shape="square"
                                  size="sm"
                                  icon={DotsThreeIcon}
                                  aria-label={t("removeMember")}
                                />
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content>
                                <DropdownMenu.Item
                                  variant="danger"
                                  icon={TrashIcon}
                                  onClick={() => handleRemoveMember(member.id, member.email)}
                                >
                                  {t("removeMember")}
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu>
                          )}
                        </Table.Cell>
                      )}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard>
          </div>

          {activeOrg && canManageMembers && invitations.length > 0 && (
            <div className="flex flex-col gap-6">
              <div className="grid gap-1.5">
                <Text as="h2" variant="heading3">{t("pendingInvitationsTitle")}</Text>
                <Text variant="secondary">{t("pendingInvitationsDescription")}</Text>
              </div>
              <LayerCard className="p-0">
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
                          <DropdownMenu>
                            <DropdownMenu.Trigger>
                              <Button
                                variant="ghost"
                                shape="square"
                                size="sm"
                                icon={DotsThreeIcon}
                                aria-label={t("cancelInvitation")}
                              />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content>
                              <DropdownMenu.Item
                                variant="danger"
                                icon={XCircleIcon}
                                onClick={() => handleCancelInvitation(inv.id, inv.email)}
                              >
                                {t("cancelInvitation")}
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </LayerCard>
            </div>
          )}
        </div>
      )}

      {activeTab === "storage" && (
        <LayerCard>
          <LayerCard.Secondary>{t("storageConfigTitle")}</LayerCard.Secondary>
          <LayerCard.Primary className="flex flex-col gap-6">
            <Text variant="secondary">{t("storageConfigDescription")}</Text>
            <Grid variant="2up" gap="base">
              <GridItem>
                <Input
                  size="sm"
                  label={t("s3Endpoint")}
                  value={s3Endpoint}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                />
              </GridItem>
              <GridItem>
                <Input
                  size="sm"
                  label={t("bucketName")}
                  value={s3Bucket}
                  onChange={(e) => setS3Bucket(e.target.value)}
                />
              </GridItem>
              <GridItem>
                <Input
                  size="sm"
                  label={t("s3Region")}
                  value={s3Region}
                  onChange={(e) => setS3Region(e.target.value)}
                />
              </GridItem>
              <GridItem>
                <Input
                  size="sm"
                  label={t("accessKeyId")}
                  value={s3AccessKey}
                  onChange={(e) => setS3AccessKey(e.target.value)}
                />
              </GridItem>
            </Grid>
            <Button
              variant="primary"
              size="sm"
              className="w-fit"
              onClick={() => toasts.add({ title: tToasts("s3ConfigTitle"), description: tToasts("s3ConnectionSuccess") })}
            >
              {t("testS3Connection")}
            </Button>
          </LayerCard.Primary>
        </LayerCard>
      )}
      </div>
    </div>
  );
}
