"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Badge,
  Banner,
  Breadcrumbs,
  Button,
  ClipboardText,
  DeleteResource,
  Dialog,
  Grid,
  GridItem,
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
  XIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ConfirmDialog } from "@/components/kumo/confirm-dialog";
import { DashboardPageSkeleton } from "@/components/shell/dashboard-page-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { authClient } from "@/lib/auth-client";
import { normalizeUserRole, type UserRole } from "@/lib/auth-permissions";
import { getInitials } from "@/lib/avatar";

type SessionRow = {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

function describeDevice(userAgent: string | null, unknownLabel: string, browserLabel: string, onOsLabel: (browser: string, os: string) => string) {
  if (!userAgent) return { label: unknownLabel, isMobile: false };
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : browserLabel;
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
  return { label: os ? onOsLabel(browser, os) : browser, isMobile };
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
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [signOutOthersOpen, setSignOutOthersOpen] = useState(false);

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

  const t = useTranslations("profilePage");
  const tErrors = useTranslations("profilePage.errors");
  const tToasts = useTranslations("profilePage.toasts");
  const tEnable = useTranslations("profilePage.enableDialog");
  const tDisable = useTranslations("profilePage.disableDialog");
  const tRegenerate = useTranslations("profilePage.regenerateDialog");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();
  usePageReady(!isPending && Boolean(session?.user));

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
      if (error) throw new Error(error.message ?? tErrors("unknown"));
      toasts.add({ title: tToasts("profileUpdatedTitle"), description: tToasts("profileUpdatedDescription") });
    } catch (err) {
      console.error("Update profile error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("profileUpdateError") });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    e.target.value = "";
    if (!selectedFile) return;

    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(selectedFile.type)) {
      toasts.add({ title: tToasts("genericError"), description: tErrors("acceptedFormats") });
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      toasts.add({ title: tToasts("genericError"), description: tErrors("imageTooLarge") });
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const uploadRes = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => null);
        throw new Error(data?.error ?? tErrors("uploadFailed"));
      }
      const { image } = await uploadRes.json();

      const { error } = await authClient.updateUser({ image });
      if (error) throw new Error(error.message ?? tErrors("unknown"));

      toasts.add({ title: tToasts("avatarUpdatedTitle"), description: tToasts("avatarUpdatedDescription") });
    } catch (err) {
      console.error("Avatar upload error:", err);
      toasts.add({
        title: tToasts("genericError"),
        description: err instanceof Error ? err.message : tToasts("avatarUploadError"),
      });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error(tErrors("removeFailed"));

      const { error } = await authClient.updateUser({ image: null });
      if (error) throw new Error(error.message ?? tErrors("unknown"));

      toasts.add({ title: tToasts("avatarRemovedTitle"), description: tToasts("avatarRemovedDescription") });
    } catch (err) {
      console.error("Avatar remove error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("avatarRemoveError") });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toasts.add({ title: tToasts("genericError"), description: tErrors("passwordsDontMatch") });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: revokeOtherSessionsOnChange,
      });
      if (error) throw new Error(error.message ?? tErrors("unknown"));
      toasts.add({ title: tToasts("passwordChangedTitle"), description: tToasts("passwordChangedDescription") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (revokeOtherSessionsOnChange) loadSessions();
    } catch (err) {
      console.error("Change password error:", err);
      toasts.add({
        title: tToasts("genericError"),
        description: err instanceof Error ? err.message : tToasts("passwordChangeError"),
      });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleRevokeSession() {
    if (!sessionToRevoke) return;
    setRevokingToken(sessionToRevoke);
    try {
      const { error } = await authClient.revokeSession({ token: sessionToRevoke });
      if (error) throw new Error(error.message ?? tErrors("unknown"));
      toasts.add({ title: tToasts("sessionRevokedTitle"), description: tToasts("sessionRevokedDescription") });
      setSessionToRevoke(null);
      loadSessions();
    } catch (err) {
      console.error("Revoke session error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("revokeSessionError") });
    } finally {
      setRevokingToken(null);
    }
  }

  async function handleRevokeOtherSessions() {
    setRevokingOthers(true);
    try {
      const { error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(error.message ?? tErrors("unknown"));
      toasts.add({ title: tToasts("devicesSignedOutTitle"), description: tToasts("devicesSignedOutDescription") });
      setSignOutOthersOpen(false);
      loadSessions();
    } catch (err) {
      console.error("Revoke other sessions error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("signOutOthersError") });
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
      if (error) throw new Error(error.message ?? tErrors("unknown"));
      setTotpURI(data?.totpURI ?? null);
      setNewBackupCodes(data?.backupCodes ?? []);
      setEnableStep("setup");
    } catch (err) {
      console.error("Enable 2FA error:", err);
      toasts.add({
        title: tToasts("genericError"),
        description: err instanceof Error ? err.message : tErrors("wrongPassword"),
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
      if (error) throw new Error(error.message ?? tErrors("invalidCode"));
      toasts.add({ title: tToasts("twoFactorEnabledTitle"), description: tToasts("twoFactorEnabledDescription") });
      setEnableDialogOpen(false);
    } catch (err) {
      console.error("Verify TOTP error:", err);
      toasts.add({
        title: tToasts("genericError"),
        description: err instanceof Error ? err.message : tErrors("invalidVerificationCode"),
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
      if (error) throw new Error(error.message ?? tErrors("unknown"));
      toasts.add({ title: tToasts("twoFactorDisabledTitle"), description: tToasts("twoFactorDisabledDescription") });
      setDisableDialogOpen(false);
    } catch (err) {
      console.error("Disable 2FA error:", err);
      toasts.add({
        title: tToasts("genericError"),
        description: err instanceof Error ? err.message : tErrors("wrongPassword"),
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
      if (error) throw new Error(error.message ?? tErrors("unknown"));
      setRegeneratedCodes(data?.backupCodes ?? []);
      setRegenerateStep("codes");
    } catch (err) {
      console.error("Regenerate backup codes error:", err);
      toasts.add({
        title: tToasts("genericError"),
        description: err instanceof Error ? err.message : tErrors("wrongPassword"),
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      const { error } = await authClient.deleteUser({});
      if (error) throw new Error(error.message ?? tErrors("unknown"));
      toasts.add({ title: tToasts("accountDeletedTitle"), description: tToasts("accountDeletedDescription") });
      router.push("/login");
    } catch (err) {
      console.error("Delete account error:", err);
      toasts.add({
        title: tToasts("genericError"),
        description:
          err instanceof Error && err.message ? err.message : tErrors("deleteAccountFallback"),
      });
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
    }
  }

  if (isPending || !session?.user) {
    return <DashboardPageSkeleton path="/dashboard/profile" />;
  }

  const user = session.user;
  const role = normalizeUserRole(user.role);

  function profileRoleLabel(value: UserRole): string {
    switch (value) {
      case "admin":
        return t("administrator");
      case "moderator":
        return t("moderator");
      case "support":
        return t("support");
      case "user":
        return "";
      default: {
        const _exhaustive: never = value;
        return _exhaustive;
      }
    }
  }

  function profileRoleBadgeVariant(value: UserRole): "primary" | "warning" | "info" | "neutral" {
    switch (value) {
      case "admin":
        return "primary";
      case "moderator":
        return "warning";
      case "support":
        return "info";
      case "user":
        return "neutral";
      default: {
        const _exhaustive: never = value;
        return _exhaustive;
      }
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
      />

      <div className="flex flex-1 flex-col gap-6 pt-6">
        <LayerCard>
          <LayerCard.Secondary className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative shrink-0">
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarSelected}
                />
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-kumo-info text-white">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt={user.name} className="size-full object-cover" />
                  ) : (
                    <Text as="span" bold>
                      {getInitials(user.name)}
                    </Text>
                  )}
                </div>
                <span className="absolute -bottom-1 -right-1">
                  <Button
                    variant="secondary"
                    shape="square"
                    size="sm"
                    icon={uploadingAvatar ? undefined : CameraIcon}
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                    disabled={uploadingAvatar}
                    aria-label={t("changeAvatarAria")}
                  >
                    {uploadingAvatar ? <Loader size="sm" /> : null}
                  </Button>
                </span>
              </div>
              <div className="grid min-w-0 gap-0.5">
                <div className="flex items-center gap-2">
                  <Text as="span" bold truncate>
                    {user.name}
                  </Text>
                  {role !== "user" && (
                    <Badge variant={profileRoleBadgeVariant(role)}>{profileRoleLabel(role)}</Badge>
                  )}
                </div>
                <Text variant="secondary" truncate>
                  {user.email}
                </Text>
                <Text variant="secondary">
                  {t("memberSince", { date: new Date(user.createdAt).toLocaleDateString(locale) })}
                </Text>
              </div>
            </div>
            {user.image && (
              <Button variant="secondary" size="sm" onClick={handleRemoveAvatar} disabled={uploadingAvatar}>
                {t("removePhoto")}
              </Button>
            )}
          </LayerCard.Secondary>
          <LayerCard.Primary className="flex flex-col gap-4">
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              <Grid variant="2up" gap="base">
                <GridItem>
                  <Input
                    size="sm"
                    label={t("fullNameLabel")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </GridItem>
                <GridItem>
                  <Input
                    size="sm"
                    label={t("emailAddressLabel")}
                    value={user.email}
                    disabled
                    description={t("emailNotEditable")}
                  />
                </GridItem>
              </Grid>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                className="w-fit"
                disabled={savingProfile || name.trim() === user.name}
              >
                {savingProfile ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("saving")}
                  </span>
                ) : (
                  t("save")
                )}
              </Button>
            </form>
          </LayerCard.Primary>
        </LayerCard>

        <div className="flex flex-col gap-6">
          <div className="grid gap-1.5">
            <Text as="h2" variant="heading3">
              {t("passwordTitle")}
            </Text>
            <Text variant="secondary">{t("passwordDescription")}</Text>
          </div>
          <LayerCard className="px-5 py-4">
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <Grid variant="2up" gap="base">
                <GridItem>
                  <SensitiveInput
                    size="sm"
                    label={t("currentPasswordLabel")}
                    value={currentPassword}
                    onValueChange={setCurrentPassword}
                    autoComplete="current-password"
                    required
                  />
                </GridItem>
                <GridItem>
                  <SensitiveInput
                    size="sm"
                    label={t("newPasswordLabel")}
                    value={newPassword}
                    onValueChange={setNewPassword}
                    autoComplete="new-password"
                    required
                  />
                </GridItem>
                <GridItem>
                  <SensitiveInput
                    size="sm"
                    label={t("confirmNewPasswordLabel")}
                    value={confirmPassword}
                    onValueChange={setConfirmPassword}
                    autoComplete="new-password"
                    required
                  />
                </GridItem>
              </Grid>
              <Switch
                label={t("signOutOtherDevices")}
                checked={revokeOtherSessionsOnChange}
                onCheckedChange={setRevokeOtherSessionsOnChange}
              />
              <Button
                variant="primary"
                size="sm"
                type="submit"
                className="w-fit"
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {savingPassword ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("changing")}
                  </span>
                ) : (
                  t("changePassword")
                )}
              </Button>
            </form>
          </LayerCard>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-1.5">
              <Text as="h2" variant="heading3">
                {t("activeSessionsTitle")}
              </Text>
              <Text variant="secondary">{t("activeSessionsDescription")}</Text>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={SignOutIcon}
              onClick={() => setSignOutOthersOpen(true)}
              disabled={revokingOthers || sortedSessions.length <= 1}
            >
              {t("signOutOthers")}
            </Button>
          </div>

          <LayerCard className="p-0">
            {loadingSessions ? (
              <div className="flex items-center gap-2 px-5 py-4">
                <Loader size="sm" />
                <Text variant="secondary">{t("loadingSessions")}</Text>
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>{t("deviceColumn")}</Table.Head>
                    <Table.Head>{t("ipAddressColumn")}</Table.Head>
                    <Table.Head>{t("lastActivityColumn")}</Table.Head>
                    <Table.Head></Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {sortedSessions.map((s) => {
                    const { label, isMobile } = describeDevice(
                      s.userAgent,
                      t("unknownDevice"),
                      t("browserGeneric"),
                      (browser, os) => t("deviceOnOs", { browser, os }),
                    );
                    const isCurrent = s.token === currentToken;
                    return (
                      <Table.Row key={s.id}>
                        <Table.Cell>
                          <div className="flex items-start gap-2">
                            <span className="h-lh flex items-center text-kumo-subtle">
                              {isMobile ? <DeviceMobileIcon size={16} /> : <DesktopIcon size={16} />}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {label}
                              {isCurrent && (
                                <Badge variant="success">
                                  <span className="flex items-center gap-1">
                                    <CheckCircleIcon size={12} /> {t("thisDevice")}
                                  </span>
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>{s.ipAddress ?? "—"}</Table.Cell>
                        <Table.Cell>{new Date(s.updatedAt).toLocaleString(locale)}</Table.Cell>
                        <Table.Cell className="text-right">
                          {!isCurrent && (
                            <Button
                              variant="secondary-destructive"
                              size="sm"
                              onClick={() => setSessionToRevoke(s.token)}
                              disabled={revokingToken === s.token}
                            >
                              {revokingToken === s.token ? <Loader size="sm" /> : t("revoke")}
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
        </div>

        <LayerCard>
          <LayerCard.Secondary className="flex items-center justify-between gap-4">
            <Text as="span">{t("twoFactorTitle")}</Text>
            {user.twoFactorEnabled ? (
              <Badge variant="success">{t("twoFactorEnabledBadge")}</Badge>
            ) : (
              <Badge variant="neutral">{t("twoFactorDisabledBadge")}</Badge>
            )}
          </LayerCard.Secondary>
          <LayerCard.Primary className="flex flex-col gap-4">
            <Text variant="secondary">{t("twoFactorDescription")}</Text>
            {user.twoFactorEnabled ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={openRegenerateDialog}>
                  {t("regenerateBackupCodes")}
                </Button>
                <Button variant="secondary-destructive" size="sm" onClick={openDisableDialog}>
                  {t("disable2fa")}
                </Button>
              </div>
            ) : (
              <Button variant="primary" size="sm" icon={ShieldCheckIcon} className="w-fit" onClick={openEnableDialog}>
                {t("enable2fa")}
              </Button>
            )}
          </LayerCard.Primary>
        </LayerCard>

        <div className="flex flex-col gap-6">
          <div className="grid gap-1.5">
            <Text as="h2" variant="heading3">
              {t("dangerZoneTitle")}
            </Text>
          </div>
          <Banner
            variant="error"
            icon={<ShieldWarningIcon weight="fill" />}
            title={t("deleteAccountTitle")}
            description={t("deleteAccountDescription")}
            action={
              <Banner.Action variant="primary" onClick={() => setDeleteDialogOpen(true)}>
                {t("deleteAccountButton")}
              </Banner.Action>
            }
          />
        </div>
      </div>

      <DeleteResource
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        resourceType={t("accountResourceType")}
        resourceName={user.email}
        onDelete={handleDeleteAccount}
        isDeleting={deletingAccount}
        deleteButtonText={t("deleteAccountButton")}
      />

      <ConfirmDialog
        open={sessionToRevoke !== null}
        onOpenChange={(open) => {
          if (!open && revokingToken === null) setSessionToRevoke(null);
        }}
        title={t("revokeSessionTitle")}
        description={t("revokeSessionDescription")}
        confirmLabel={t("revokeSessionConfirm")}
        onConfirm={handleRevokeSession}
        isConfirming={revokingToken !== null}
      />

      <ConfirmDialog
        open={signOutOthersOpen}
        onOpenChange={(open) => {
          if (!revokingOthers) setSignOutOthersOpen(open);
        }}
        title={t("signOutOthersTitle")}
        description={t("signOutOthersDescription")}
        confirmLabel={t("signOutOthersConfirm")}
        onConfirm={handleRevokeOtherSessions}
        isConfirming={revokingOthers}
      />

      {/* Activer la 2FA */}
      <Dialog.Root open={enableDialogOpen} onOpenChange={setEnableDialogOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title>{tEnable("title")}</Dialog.Title>
            <Dialog.Close
              aria-label={tEnable("close")}
              render={(props) => <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={tEnable("close")} />}
            />
          </div>

          {enableStep === "password" && (
            <form onSubmit={handleEnableStart} className="flex flex-col gap-4">
              <Text variant="secondary">{tEnable("confirmPassword")}</Text>
              <SensitiveInput
                size="sm"
                label={tEnable("passwordLabel")}
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
                      <Loader size="sm" /> {tEnable("verifying")}
                    </span>
                  ) : (
                    tEnable("continue")
                  )}
                </Button>
              </div>
            </form>
          )}

          {enableStep === "setup" && totpURI && (
            <div className="flex flex-col gap-4">
              <Text variant="secondary">
                {tEnable("scanInstructions")}
              </Text>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={totpURI} size={180} />
              </div>
              <ClipboardText text={extractTotpSecret(totpURI)} size="sm" />

              {newBackupCodes.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-kumo-line pt-4">
                  <Text as="p" bold>{tEnable("backupCodesTitle")}</Text>
                  <Text variant="secondary">
                    {tEnable("backupCodesDescription")}
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
                  {tEnable("savedCodesContinue")}
                </Button>
              </div>
            </div>
          )}

          {enableStep === "verify" && (
            <form onSubmit={handleEnableVerify} className="flex flex-col gap-4">
              <Text variant="secondary">
                {tEnable("verifyInstructions")}
              </Text>
              <Input
                size="sm"
                label={tEnable("verificationCodeLabel")}
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
                      <Loader size="sm" /> {tEnable("enabling")}
                    </span>
                  ) : (
                    tEnable("enable")
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
            <Dialog.Title>{tDisable("title")}</Dialog.Title>
            <Dialog.Close
              aria-label={tEnable("close")}
              render={(props) => <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={tEnable("close")} />}
            />
          </div>
          <form onSubmit={handleDisableSubmit} className="flex flex-col gap-4">
            <Text variant="secondary">
              {tDisable("warning")}
            </Text>
            <SensitiveInput
              size="sm"
              label={tDisable("passwordLabel")}
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
                    <Loader size="sm" /> {tDisable("disabling")}
                  </span>
                ) : (
                  tDisable("disable")
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
            <Dialog.Title>{tRegenerate("title")}</Dialog.Title>
            <Dialog.Close
              aria-label={tEnable("close")}
              render={(props) => <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={tEnable("close")} />}
            />
          </div>

          {regenerateStep === "password" && (
            <form onSubmit={handleRegenerateSubmit} className="flex flex-col gap-4">
              <Text variant="secondary">
                {tRegenerate("warning")}
              </Text>
              <SensitiveInput
                size="sm"
                label={tRegenerate("passwordLabel")}
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
                      <Loader size="sm" /> {tRegenerate("generating")}
                    </span>
                  ) : (
                    tRegenerate("generate")
                  )}
                </Button>
              </div>
            </form>
          )}

          {regenerateStep === "codes" && (
            <div className="flex flex-col gap-4">
              <Text variant="secondary">{tRegenerate("keepSafe")}</Text>
              <div className="grid grid-cols-2 gap-2">
                {regeneratedCodes.map((backupCode) => (
                  <ClipboardText key={backupCode} text={backupCode} size="sm" />
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setRegenerateDialogOpen(false)}>
                  {tRegenerate("done")}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
