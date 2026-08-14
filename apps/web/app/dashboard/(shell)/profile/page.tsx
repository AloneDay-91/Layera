"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Breadcrumbs,
  Button,
  ClipboardText,
  DeleteResource,
  Dialog,
  Input,
  LayerCard,
  Loader,
  SensitiveInput,
  Switch,
  Table,
  Text,
  useKumoToastManager,
} from "@cloudflare/kumo";
import { QRCodeSVG } from "qrcode.react";
import {
  CameraIcon,
  CheckCircleIcon,
  DesktopIcon,
  DeviceMobileIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
  SignOutIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { authClient } from "@/lib/auth-client";
import { getInitials } from "@/lib/avatar";

type SessionRow = {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

function describeDevice(userAgent: string | null) {
  if (!userAgent) return { label: "Appareil inconnu", isMobile: false };
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Navigateur";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return { label: os ? `${browser} sur ${os}` : browser, isMobile };
}

function extractTotpSecret(totpURI: string) {
  const match = totpURI.match(/[?&]secret=([^&]+)/);
  return match ? decodeURIComponent(match[1]!) : "";
}

export default function ProfilePage() {
  const router = useRouter();
  const toasts = useKumoToastManager();
  const { data: session, isPending } = authClient.useSession();

  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessionsOnChange, setRevokeOtherSessionsOnChange] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [enableDialogOpen, setEnableDialogOpen] = useState(false);
  const [enableStep, setEnableStep] = useState<"password" | "setup" | "verify">("password");
  const [enablePassword, setEnablePassword] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [enableSubmitting, setEnableSubmitting] = useState(false);

  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling, setDisabling] = useState(false);

  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateStep, setRegenerateStep] = useState<"password" | "codes">("password");
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[]>([]);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "");
    }
  }, [session?.user]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const { data } = await authClient.listSessions();
      setSessions((data as SessionRow[] | null | undefined) ?? []);
    } catch (err) {
      console.error("Erreur chargement des sessions :", err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const currentToken = session?.session?.token;

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        if (a.token === currentToken) return -1;
        if (b.token === currentToken) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [sessions, currentToken],
  );

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      const { error } = await authClient.updateUser({ name: name.trim() });
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      toasts.add({ title: "Profil mis à jour", description: "Votre nom a été enregistré." });
    } catch (err) {
      console.error("Update profile error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de mettre à jour le profil." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    e.target.value = "";
    if (!selectedFile) return;

    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(selectedFile.type)) {
      toasts.add({ title: "Erreur", description: "Formats acceptés : PNG, JPEG, GIF, WebP." });
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      toasts.add({ title: "Erreur", description: "L'image ne doit pas dépasser 5 Mo." });
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const uploadRes = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => null);
        throw new Error(data?.error ?? "Échec du téléversement");
      }
      const { image } = await uploadRes.json();

      const { error } = await authClient.updateUser({ image });
      if (error) throw new Error(error.message ?? "Erreur inconnue");

      toasts.add({ title: "Photo de profil mise à jour", description: "Votre nouvelle photo a été enregistrée." });
    } catch (err) {
      console.error("Avatar upload error:", err);
      toasts.add({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de téléverser la photo de profil.",
      });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");

      const { error } = await authClient.updateUser({ image: null });
      if (error) throw new Error(error.message ?? "Erreur inconnue");

      toasts.add({ title: "Photo de profil retirée", description: "Votre photo de profil a été supprimée." });
    } catch (err) {
      console.error("Avatar remove error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de retirer la photo de profil." });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toasts.add({ title: "Erreur", description: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: revokeOtherSessionsOnChange,
      });
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      toasts.add({ title: "Mot de passe modifié", description: "Votre mot de passe a été mis à jour avec succès." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (revokeOtherSessionsOnChange) loadSessions();
    } catch (err) {
      console.error("Change password error:", err);
      toasts.add({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de modifier le mot de passe.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleRevokeSession(token: string) {
    setRevokingToken(token);
    try {
      const { error } = await authClient.revokeSession({ token });
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      toasts.add({ title: "Session révoquée", description: "Cet appareil a été déconnecté." });
      loadSessions();
    } catch (err) {
      console.error("Revoke session error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de révoquer cette session." });
    } finally {
      setRevokingToken(null);
    }
  }

  async function handleRevokeOtherSessions() {
    setRevokingOthers(true);
    try {
      const { error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      toasts.add({ title: "Appareils déconnectés", description: "Toutes les autres sessions ont été révoquées." });
      loadSessions();
    } catch (err) {
      console.error("Revoke other sessions error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de déconnecter les autres appareils." });
    } finally {
      setRevokingOthers(false);
    }
  }

  function openEnableDialog() {
    setEnableStep("password");
    setEnablePassword("");
    setTotpURI(null);
    setNewBackupCodes([]);
    setVerifyCode("");
    setEnableDialogOpen(true);
  }

  async function handleEnableStart(e: React.FormEvent) {
    e.preventDefault();
    setEnableSubmitting(true);
    try {
      const { data, error } = await authClient.twoFactor.enable({ password: enablePassword });
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      setTotpURI(data?.totpURI ?? null);
      setNewBackupCodes(data?.backupCodes ?? []);
      setEnableStep("setup");
    } catch (err) {
      console.error("Enable 2FA error:", err);
      toasts.add({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Mot de passe incorrect.",
      });
    } finally {
      setEnableSubmitting(false);
    }
  }

  async function handleEnableVerify(e: React.FormEvent) {
    e.preventDefault();
    setEnableSubmitting(true);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code: verifyCode });
      if (error) throw new Error(error.message ?? "Code invalide");
      toasts.add({ title: "2FA activée", description: "L'authentification à deux facteurs est maintenant active." });
      setEnableDialogOpen(false);
    } catch (err) {
      console.error("Verify TOTP error:", err);
      toasts.add({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Code de vérification invalide.",
      });
    } finally {
      setEnableSubmitting(false);
    }
  }

  function openDisableDialog() {
    setDisablePassword("");
    setDisableDialogOpen(true);
  }

  async function handleDisableSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDisabling(true);
    try {
      const { error } = await authClient.twoFactor.disable({ password: disablePassword });
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      toasts.add({ title: "2FA désactivée", description: "L'authentification à deux facteurs a été désactivée." });
      setDisableDialogOpen(false);
    } catch (err) {
      console.error("Disable 2FA error:", err);
      toasts.add({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Mot de passe incorrect.",
      });
    } finally {
      setDisabling(false);
    }
  }

  function openRegenerateDialog() {
    setRegenerateStep("password");
    setRegeneratePassword("");
    setRegeneratedCodes([]);
    setRegenerateDialogOpen(true);
  }

  async function handleRegenerateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegenerating(true);
    try {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password: regeneratePassword });
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      setRegeneratedCodes(data?.backupCodes ?? []);
      setRegenerateStep("codes");
    } catch (err) {
      console.error("Regenerate backup codes error:", err);
      toasts.add({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Mot de passe incorrect.",
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      const { error } = await authClient.deleteUser({});
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      toasts.add({ title: "Compte supprimé", description: "Votre compte a été supprimé définitivement." });
      router.push("/login");
    } catch (err) {
      console.error("Delete account error:", err);
      toasts.add({
        title: "Erreur",
        description:
          err instanceof Error && err.message
            ? err.message
            : "Impossible de supprimer le compte. Reconnectez-vous récemment puis réessayez.",
      });
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
    }
  }

  if (isPending || !session?.user) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          className="-mx-6 -mt-6"
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
              <Breadcrumbs.Separator />
              <Breadcrumbs.Current>Mon profil</Breadcrumbs.Current>
            </Breadcrumbs>
          }
          title="Mon profil"
        />
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      </div>
    );
  }

  const user = session.user;
  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Mon profil</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Mon profil"
        description="Gérez vos informations personnelles, votre sécurité et vos sessions actives."
      />

      <div className="flex flex-1 flex-col gap-6 max-w-3xl pt-6">
        {/* Identité */}
        <LayerCard className="flex flex-col gap-6 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <input
                id="avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarSelected}
              />
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-kumo-info text-lg font-semibold text-white">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  getInitials(user.name)
                )}
              </div>
              <button
                type="button"
                onClick={() => document.getElementById("avatar-upload")?.click()}
                disabled={uploadingAvatar}
                aria-label="Changer la photo de profil"
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-kumo-base text-kumo-default ring ring-kumo-line"
              >
                {uploadingAvatar ? <Loader size="sm" /> : <CameraIcon size={14} />}
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Text as="h2" variant="heading3" truncate>
                  {user.name}
                </Text>
                {isAdmin && <Badge variant="primary">Administrateur</Badge>}
              </div>
              <Text variant="secondary" truncate>
                {user.email}
              </Text>
              <Text as="span" size="sm" variant="secondary">
                Membre depuis le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
              </Text>
            </div>
            {user.image && (
              <Button variant="secondary" size="sm" onClick={handleRemoveAvatar} disabled={uploadingAvatar}>
                Retirer la photo
              </Button>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 border-t border-kumo-line pt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                size="sm"
                label="Nom complet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                size="sm"
                label="Adresse email"
                value={user.email}
                disabled
                description="Non modifiable pour le moment."
              />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" type="submit" disabled={savingProfile || name.trim() === user.name}>
                {savingProfile ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Enregistrement…
                  </span>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </div>
          </form>
        </LayerCard>

        {/* Mot de passe */}
        <LayerCard className="flex flex-col gap-4 px-5 py-4">
          <div>
            <Text as="h2" variant="heading3">
              Mot de passe
            </Text>
            <Text variant="secondary">Choisissez un mot de passe robuste que vous n&apos;utilisez nulle part ailleurs.</Text>
          </div>

          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SensitiveInput
                size="sm"
                label="Mot de passe actuel"
                value={currentPassword}
                onValueChange={setCurrentPassword}
                autoComplete="current-password"
                required
              />
              <SensitiveInput
                size="sm"
                label="Nouveau mot de passe"
                value={newPassword}
                onValueChange={setNewPassword}
                autoComplete="new-password"
                required
              />
              <SensitiveInput
                size="sm"
                label="Confirmer le nouveau mot de passe"
                value={confirmPassword}
                onValueChange={setConfirmPassword}
                autoComplete="new-password"
                required
              />
            </div>

            <Switch
              label="Déconnecter tous les autres appareils"
              checked={revokeOtherSessionsOnChange}
              onCheckedChange={setRevokeOtherSessionsOnChange}
            />

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {savingPassword ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Modification…
                  </span>
                ) : (
                  "Modifier le mot de passe"
                )}
              </Button>
            </div>
          </form>
        </LayerCard>

        {/* Sessions actives */}
        <LayerCard className="flex flex-col gap-4 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Text as="h2" variant="heading3">
                Sessions actives
              </Text>
              <Text variant="secondary">Les appareils actuellement connectés à votre compte.</Text>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={SignOutIcon}
              onClick={handleRevokeOtherSessions}
              disabled={revokingOthers || sortedSessions.length <= 1}
            >
              Déconnecter les autres
            </Button>
          </div>

          {loadingSessions ? (
            <div className="flex items-center gap-2 py-4">
              <Loader size="sm" /> Chargement des sessions…
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Appareil</Table.Head>
                  <Table.Head>Adresse IP</Table.Head>
                  <Table.Head>Dernière activité</Table.Head>
                  <Table.Head></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedSessions.map((s) => {
                  const { label, isMobile } = describeDevice(s.userAgent);
                  const isCurrent = s.token === currentToken;
                  return (
                    <Table.Row key={s.id}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <span className="h-lh flex items-center text-kumo-subtle">
                            {isMobile ? <DeviceMobileIcon size={16} /> : <DesktopIcon size={16} />}
                          </span>
                          {label}
                          {isCurrent && (
                            <Badge variant="success">
                              <span className="flex items-center gap-1">
                                <CheckCircleIcon size={12} /> Cet appareil
                              </span>
                            </Badge>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>{s.ipAddress ?? "—"}</Table.Cell>
                      <Table.Cell>{new Date(s.updatedAt).toLocaleString("fr-FR")}</Table.Cell>
                      <Table.Cell>
                        {!isCurrent && (
                          <Button
                            variant="secondary-destructive"
                            size="sm"
                            onClick={() => handleRevokeSession(s.token)}
                            disabled={revokingToken === s.token}
                          >
                            {revokingToken === s.token ? <Loader size="sm" /> : "Révoquer"}
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          )}
        </LayerCard>

        {/* Authentification à deux facteurs */}
        <LayerCard className="flex flex-col gap-4 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Text as="h2" variant="heading3">
                  Authentification à deux facteurs
                </Text>
                {user.twoFactorEnabled ? (
                  <Badge variant="success">Activée</Badge>
                ) : (
                  <Badge variant="neutral">Désactivée</Badge>
                )}
              </div>
              <Text variant="secondary">
                Protégez votre compte avec un code généré par une application d&apos;authentification (Google
                Authenticator, 1Password, Authy…).
              </Text>
            </div>
          </div>

          {user.twoFactorEnabled ? (
            <div className="flex gap-2 border-t border-kumo-line pt-4">
              <Button variant="secondary" size="sm" onClick={openRegenerateDialog}>
                Régénérer les codes de secours
              </Button>
              <Button variant="secondary-destructive" size="sm" onClick={openDisableDialog}>
                Désactiver la 2FA
              </Button>
            </div>
          ) : (
            <div className="border-t border-kumo-line pt-4">
              <Button variant="primary" size="sm" icon={ShieldCheckIcon} onClick={openEnableDialog}>
                Activer la 2FA
              </Button>
            </div>
          )}
        </LayerCard>

        {/* Zone de danger */}
        <LayerCard className="flex flex-col gap-4 px-5 py-4 ring-kumo-danger/40">
          <div className="flex items-center gap-2 text-kumo-danger">
            <ShieldWarningIcon size={18} />
            <Text as="h2" variant="heading3" DANGEROUS_className="text-kumo-danger">
              Zone de danger
            </Text>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Text as="p" bold>Supprimer mon compte</Text>
              <Text variant="secondary">
                Cette action est définitive. Vos fichiers, dossiers et partages seront supprimés.
              </Text>
            </div>
            <Button variant="destructive" size="sm" icon={TrashIcon} onClick={() => setDeleteDialogOpen(true)}>
              Supprimer mon compte
            </Button>
          </div>
        </LayerCard>
      </div>

      <DeleteResource
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        resourceType="Compte"
        resourceName={user.email}
        onDelete={handleDeleteAccount}
        isDeleting={deletingAccount}
        deleteButtonText="Supprimer mon compte"
      />

      {/* Activer la 2FA */}
      <Dialog.Root open={enableDialogOpen} onOpenChange={setEnableDialogOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Activer l&apos;authentification à deux facteurs</Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />}
            />
          </div>

          {enableStep === "password" && (
            <form onSubmit={handleEnableStart} className="flex flex-col gap-4">
              <Text variant="secondary">Confirmez votre mot de passe pour continuer.</Text>
              <SensitiveInput
                size="sm"
                label="Mot de passe"
                value={enablePassword}
                onValueChange={setEnablePassword}
                autoComplete="current-password"
                required
                autoFocus
              />
              <div className="flex justify-end">
                <Button variant="primary" size="sm" type="submit" disabled={enableSubmitting || !enablePassword}>
                  {enableSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader size="sm" /> Vérification…
                    </span>
                  ) : (
                    "Continuer"
                  )}
                </Button>
              </div>
            </form>
          )}

          {enableStep === "setup" && totpURI && (
            <div className="flex flex-col gap-4">
              <Text variant="secondary">
                Scannez ce code avec votre application d&apos;authentification, ou saisissez la clé manuellement.
              </Text>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={totpURI} size={180} />
              </div>
              <ClipboardText text={extractTotpSecret(totpURI)} size="sm" />

              {newBackupCodes.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-kumo-line pt-4">
                  <Text as="p" bold>Codes de secours</Text>
                  <Text variant="secondary">
                    Conservez ces codes en lieu sûr. Chacun ne peut être utilisé qu&apos;une seule fois pour vous
                    connecter si vous perdez l&apos;accès à votre application d&apos;authentification.
                  </Text>
                  <div className="grid grid-cols-2 gap-2">
                    {newBackupCodes.map((backupCode) => (
                      <ClipboardText key={backupCode} text={backupCode} size="sm" />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setEnableStep("verify")}>
                  J&apos;ai enregistré mes codes, continuer
                </Button>
              </div>
            </div>
          )}

          {enableStep === "verify" && (
            <form onSubmit={handleEnableVerify} className="flex flex-col gap-4">
              <Text variant="secondary">
                Entrez le code à 6 chiffres affiché par votre application d&apos;authentification pour confirmer
                l&apos;activation.
              </Text>
              <Input
                size="sm"
                label="Code de vérification"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                required
                autoFocus
                placeholder="123456"
                maxLength={6}
              />
              <div className="flex justify-end">
                <Button variant="primary" size="sm" type="submit" disabled={enableSubmitting || !verifyCode}>
                  {enableSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader size="sm" /> Activation…
                    </span>
                  ) : (
                    "Activer la 2FA"
                  )}
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      </Dialog.Root>

      {/* Désactiver la 2FA */}
      <Dialog.Root open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Désactiver la 2FA</Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />}
            />
          </div>
          <form onSubmit={handleDisableSubmit} className="flex flex-col gap-4">
            <Text variant="secondary">
              Votre compte ne sera plus protégé par un second facteur. Confirmez votre mot de passe pour continuer.
            </Text>
            <SensitiveInput
              size="sm"
              label="Mot de passe"
              value={disablePassword}
              onValueChange={setDisablePassword}
              autoComplete="current-password"
              required
              autoFocus
            />
            <div className="flex justify-end">
              <Button variant="destructive" size="sm" type="submit" disabled={disabling || !disablePassword}>
                {disabling ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Désactivation…
                  </span>
                ) : (
                  "Désactiver la 2FA"
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      {/* Régénérer les codes de secours */}
      <Dialog.Root open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Régénérer les codes de secours</Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />}
            />
          </div>

          {regenerateStep === "password" && (
            <form onSubmit={handleRegenerateSubmit} className="flex flex-col gap-4">
              <Text variant="secondary">
                Les anciens codes de secours seront invalidés. Confirmez votre mot de passe pour continuer.
              </Text>
              <SensitiveInput
                size="sm"
                label="Mot de passe"
                value={regeneratePassword}
                onValueChange={setRegeneratePassword}
                autoComplete="current-password"
                required
                autoFocus
              />
              <div className="flex justify-end">
                <Button variant="primary" size="sm" type="submit" disabled={regenerating || !regeneratePassword}>
                  {regenerating ? (
                    <span className="flex items-center gap-1.5">
                      <Loader size="sm" /> Génération…
                    </span>
                  ) : (
                    "Générer de nouveaux codes"
                  )}
                </Button>
              </div>
            </form>
          )}

          {regenerateStep === "codes" && (
            <div className="flex flex-col gap-4">
              <Text variant="secondary">Conservez ces nouveaux codes en lieu sûr. Les anciens ne fonctionnent plus.</Text>
              <div className="grid grid-cols-2 gap-2">
                {regeneratedCodes.map((backupCode) => (
                  <ClipboardText key={backupCode} text={backupCode} size="sm" />
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setRegenerateDialogOpen(false)}>
                  Terminé
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
