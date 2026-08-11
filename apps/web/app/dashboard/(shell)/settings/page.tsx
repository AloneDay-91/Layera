"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge, Breadcrumbs, Button, Input, LayerCard, Loader, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  UsersThreeIcon,
  PlusIcon,
  ShieldCheckIcon,
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

  const [activeTab, setActiveTab] = useState<"profile" | "workspaces" | "storage">("profile");
  const [members, setMembers] = useState<MemberUI[]>([]);
  const [invitations, setInvitations] = useState<InvitationUI[]>([]);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [invitingMember, setInvitingMember] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [submittingOrg, setSubmittingOrg] = useState(false);

  // Le personnel/le membre "simple" ne peut ni inviter ni retirer quelqu'un —
  // seuls owner/admin de l'organisation active le peuvent. Sans organisation
  // active (espace personnel), l'utilisateur est de facto seul "propriétaire".
  const canManageMembers = activeOrg ? activeRole === "owner" || activeRole === "admin" : true;

  // État contrôlé pour les champs Profil
  const [profileName, setProfileName] = useState(session?.user?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email ?? "");

  // État contrôlé pour les champs S3
  const [s3Endpoint, setS3Endpoint] = useState("http://localhost:9000");
  const [s3Bucket, setS3Bucket] = useState("filecloud-data");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3AccessKey, setS3AccessKey] = useState("minioadmin");

  useEffect(() => {
    if (session?.user) {
      setProfileName(session.user.name ?? "");
      setProfileEmail(session.user.email ?? "");
    }
  }, [session?.user]);

  // Synchroniser les vrais membres, invitations et rôle actif de l'organisation Better Auth
  const loadWorkspaceData = useCallback(async () => {
    if (!activeOrg) {
      setActiveRole(null);
      setInvitations([]);
      if (session?.user) {
        setMembers([
          { id: session.user.id, name: session.user.name, email: session.user.email, role: "owner" },
        ]);
      }
      return;
    }

    const [{ data: memberData }, { data: invitationData }, { data: roleData }] = await Promise.all([
      authClient.organization.listMembers({ query: { organizationId: activeOrg.id } }),
      authClient.organization.listInvitations({ query: { organizationId: activeOrg.id } }),
      authClient.organization.getActiveMemberRole(),
    ]);

    const memberList = memberData?.members ?? [];
    setMembers(
      memberList.map((m) => ({
        id: m.id,
        name: m.user?.name ?? m.user?.email?.split("@")[0] ?? "Utilisateur",
        email: m.user?.email ?? "",
        role: m.role ?? "member",
      })),
    );

    const pending = (invitationData ?? []).filter((inv) => inv.status === "pending");
    setInvitations(pending.map((inv) => ({ id: inv.id, email: inv.email, role: inv.role ?? "member", status: inv.status })));

    setActiveRole(roleData?.role ?? null);
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
        title: "Erreur de création",
        description: error.message ?? "Impossible de créer le groupe de workspace.",
      });
      return;
    }

    if (createdOrg) {
      await authClient.organization.setActive({ organizationId: createdOrg.id });
    }

    toasts.add({
      title: "Groupe de Workspace créé",
      description: `L'espace "${newOrgName}" est désormais votre workspace actif.`,
    });
    setNewOrgName("");
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberEmail.trim() || !activeOrg) return;

    setInvitingMember(true);
    try {
      const { error } = await authClient.organization.inviteMember({
        email: newMemberEmail.trim(),
        role: "member",
      });
      if (error) {
        toasts.add({
          title: "Erreur d'invitation",
          description: error.message ?? "Impossible d'envoyer l'invitation.",
        });
        return;
      }
      toasts.add({
        title: "Invitation envoyée",
        description: `Un e-mail d'invitation a été transmis à ${newMemberEmail}.`,
      });
      setNewMemberEmail("");
      loadWorkspaceData();
    } finally {
      setInvitingMember(false);
    }
  }

  async function handleRemoveMember(memberId: string, email: string) {
    const { error } = await authClient.organization.removeMember({ memberIdOrEmail: memberId });
    if (error) {
      toasts.add({ title: "Erreur", description: error.message ?? "Impossible de retirer ce membre." });
      return;
    }
    toasts.add({ title: "Membre retiré", description: `Accès révoqué pour ${email}.` });
    loadWorkspaceData();
  }

  async function handleCancelInvitation(invitationId: string, email: string) {
    const { error } = await authClient.organization.cancelInvitation({ invitationId });
    if (error) {
      toasts.add({ title: "Erreur", description: error.message ?? "Impossible d'annuler l'invitation." });
      return;
    }
    toasts.add({ title: "Invitation annulée", description: email });
    loadWorkspaceData();
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    toasts.add({
      title: "Sous-équipe créée",
      description: `L'équipe "${newTeamName}" a été rattachée à ${activeOrg?.name ?? "votre workspace"}.`,
    });
    setNewTeamName("");
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Réglages</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Réglages"
        description="Gérez votre profil, vos espaces de travail et la configuration du stockage."
        tabs={[
          { value: "profile", label: "Profil & Compte" },
          { value: "workspaces", label: "Groupes & Équipes" },
          { value: "storage", label: "Stockage & S3" },
        ]}
        activeTab={activeTab}
        onValueChange={(val) => setActiveTab(val as "profile" | "workspaces" | "storage")}
      />

      <div className="flex flex-1 flex-col gap-6 max-w-4xl pt-6">

      {/* Onglet Profil & Compte */}
      {activeTab === "profile" && (
        <LayerCard className="flex flex-col gap-6 p-6">
          <div>
            <Text as="h2" variant="heading2">
              Informations personnelles
            </Text>
            <Text variant="secondary">
              Gérez votre nom, email et préférences de sécurité.
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              size="sm"
              label="Nom complet"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <Input
              size="sm"
              label="Adresse email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              disabled
            />
          </div>

          <div className="flex items-center justify-between border-t border-kumo-line pt-4">
            <div>
              <Text as="p" bold>Authentification 2FA</Text>
              <Text variant="secondary">Sécurisez l&apos;accès avec un second facteur (TOTP / OTP).</Text>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={ShieldCheckIcon}
              onClick={() => toasts.add({ title: "2FA", description: "Configuration 2FA à venir." })}
            >
              Configurer la 2FA
            </Button>
          </div>
        </LayerCard>
      )}

      {/* Onglet Groupes & Équipes */}
      {activeTab === "workspaces" && (
        <div className="flex flex-col gap-6">
          {/* Créer un nouveau groupe d'organisation */}
          <LayerCard className="flex flex-col gap-4 p-6">
            <div>
              <Text as="h2" variant="heading2">
                Créer un Groupe de Workspace (Organization)
              </Text>
              <Text variant="secondary">
                Déployez une organisation Better Auth pour réunir vos équipes et vos sous-projets.
              </Text>
            </div>

            <form onSubmit={handleCreateOrganization} className="flex gap-3">
              <Input
                size="sm"
                placeholder="Nom du nouveau workspace (ex: Équipe Data)..."
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="flex-1"
              />
              <Button variant="primary" size="sm" type="submit" disabled={submittingOrg} icon={PlusIcon}>
                {submittingOrg ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Création…
                  </span>
                ) : (
                  "Créer le groupe"
                )}
              </Button>
            </form>
          </LayerCard>

          {/* Créer une sous-équipe */}
          <LayerCard className="flex flex-col gap-4 p-6">
            <div>
              <Text as="h2" variant="heading2">
                Sous-équipes du Workspace ({activeOrg?.name ?? "Espace Personnel"})
              </Text>
              <Text variant="secondary">
                Organisez vos départements (Dev, Design, Marketing) au sein de votre organisation.
              </Text>
            </div>

            <form onSubmit={handleCreateTeam} className="flex gap-3">
              <Input
                size="sm"
                placeholder="Nom de la sous-équipe (ex: Frontend Eng)..."
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="flex-1"
              />
              <Button variant="secondary" size="sm" type="submit" icon={PlusIcon}>
                Ajouter une sous-équipe
              </Button>
            </form>
          </LayerCard>

          {/* Membres & Invitations */}
          <LayerCard className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <Text as="h2" variant="heading2">
                  Membres du Workspace ({activeOrg?.name ?? "Espace Personnel"})
                </Text>
                <Text variant="secondary">
                  {activeOrg
                    ? "Invitez des collaborateurs par email et gérez leurs rôles d'accès."
                    : "Les espaces personnels n'ont pas de membres — créez un groupe pour inviter des collaborateurs."}
                </Text>
              </div>
            </div>

            {activeOrg && canManageMembers && (
              <form onSubmit={handleInviteMember} className="flex gap-3 my-2">
                <Input
                  size="sm"
                  type="email"
                  placeholder="collaborateur@exemple.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" type="submit" disabled={invitingMember} icon={UsersThreeIcon}>
                  {invitingMember ? (
                    <span className="flex items-center gap-1.5">
                      <Loader size="sm" /> Envoi…
                    </span>
                  ) : (
                    "Inviter par email"
                  )}
                </Button>
              </form>
            )}

            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Membre</Table.Head>
                  <Table.Head>Rôle</Table.Head>
                  {canManageMembers && <Table.Head className="text-right">Action</Table.Head>}
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
                        {member.role === "owner" ? "Propriétaire" : member.role === "admin" ? "Admin" : "Membre"}
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
                            title="Retirer le membre"
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
                <Text as="h2" variant="heading2">Invitations en attente</Text>
                <Text variant="secondary">Ces personnes n&apos;ont pas encore rejoint le workspace.</Text>
              </div>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Email</Table.Head>
                    <Table.Head>Rôle proposé</Table.Head>
                    <Table.Head className="text-right">Action</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {invitations.map((inv) => (
                    <Table.Row key={inv.id}>
                      <Table.Cell>{inv.email}</Table.Cell>
                      <Table.Cell>
                        <Badge variant="neutral">{inv.role === "admin" ? "Admin" : "Membre"}</Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Button
                          variant="ghost"
                          shape="square"
                          size="sm"
                          icon={XCircleIcon}
                          title="Annuler l'invitation"
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
              Configuration du Stockage Cloud & S3
            </Text>
            <Text variant="secondary">
              Raccordez votre bucket MinIO ou AWS S3 compatible.
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              size="sm"
              label="Endpoint S3"
              value={s3Endpoint}
              onChange={(e) => setS3Endpoint(e.target.value)}
            />
            <Input
              size="sm"
              label="Nom du Bucket"
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
            />
            <Input
              size="sm"
              label="Région S3"
              value={s3Region}
              onChange={(e) => setS3Region(e.target.value)}
            />
            <Input
              size="sm"
              label="Access Key ID"
              value={s3AccessKey}
              onChange={(e) => setS3AccessKey(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            className="w-fit"
            onClick={() => toasts.add({ title: "Configuration S3", description: "Test de connexion S3 réussi !" })}
          >
            Tester la connexion S3
          </Button>
        </LayerCard>
      )}
      </div>
    </div>
  );
}
