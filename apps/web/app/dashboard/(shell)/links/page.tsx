"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Badge,
  Breadcrumbs,
  Button,
  DatePicker,
  Dialog,
  Empty,
  Input,
  LayerCard,
  Loader,
  Popover,
  Table,
  Text,
  useKumoToastManager,
} from "@cloudflare/kumo";
import { LinkIcon, CopyIcon, XCircleIcon, PencilSimpleIcon, XIcon, LockIcon, ClockIcon, CalendarIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ConfirmDialog } from "@/components/kumo/confirm-dialog";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { FeatureDisabledState } from "@/components/shell/coming-soon";
import { useInstanceFeatures } from "@/components/shell/instance-features";

type ShareLinkItem = {
  id: string;
  token: string;
  itemName: string;
  itemType: "file" | "folder";
  createdAt: string;
  expiresAt: string | null;
  hasPassword: boolean;
};

// A share expires at the end (23:59:59) of the selected local day.
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function LinksPage() {
  const toasts = useKumoToastManager();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { features } = useInstanceFeatures();
  const [shares, setShares] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [shareToRevoke, setShareToRevoke] = useState<ShareLinkItem | null>(null);

  const [editShare, setEditShare] = useState<ShareLinkItem | null>(null);
  const [editExpiresDate, setEditExpiresDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const t = useTranslations("linksPage");
  const tToasts = useTranslations("linksPage.toasts");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();

  async function fetchShares() {
    setLoading(true);
    try {
      const res = await fetch("/api/shares");
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares ?? []);
      }
    } catch (err) {
      console.error("Erreur chargement des liens de partage :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!features.publicSharingEnabled) {
      setLoading(false);
      return;
    }
    fetchShares();
  }, [activeOrg?.id, features.publicSharingEnabled]);

  function shareUrl(token: string) {
    return `${window.location.origin}/share/${token}`;
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(shareUrl(token));
    toasts.add({ title: tToasts("linkCopiedTitle"), description: tToasts("linkCopiedDescription") });
  }

  async function handleRevoke() {
    if (!shareToRevoke) return;
    setRevokingId(shareToRevoke.id);
    try {
      const res = await fetch(`/api/shares?id=${shareToRevoke.id}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({
          title: tToasts("linkRevokedTitle"),
          description: tToasts("linkRevokedDescription", { name: shareToRevoke.itemName }),
        });
        setShareToRevoke(null);
        fetchShares();
      }
    } catch (err) {
      console.error("Revoke error:", err);
    } finally {
      setRevokingId(null);
    }
  }

  function openEdit(share: ShareLinkItem) {
    setEditShare(share);
    setEditExpiresDate(share.expiresAt ? new Date(share.expiresAt) : undefined);
    setEditPassword("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editShare) return;

    setSavingEdit(true);
    try {
      const res = await fetch("/api/shares", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editShare.id,
          expiresAt: editExpiresDate ? endOfDay(editExpiresDate).toISOString() : null,
          password: editPassword ? editPassword : undefined,
        }),
      });

      if (res.ok) {
        toasts.add({ title: tToasts("linkUpdatedTitle"), description: tToasts("linkUpdatedDescription", { name: editShare.itemName }) });
        setEditShare(null);
        fetchShares();
      } else {
        toasts.add({ title: tToasts("genericError"), description: tToasts("linkUpdateErrorDescription") });
      }
    } catch (err) {
      console.error("Edit error:", err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRemovePassword() {
    if (!editShare) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/shares", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editShare.id, password: null }),
      });
      if (res.ok) {
        setEditShare({ ...editShare, hasPassword: false });
        setEditPassword("");
        toasts.add({ title: tToasts("passwordRemovedTitle"), description: tToasts("passwordRemovedDescription") });
        fetchShares();
      }
    } catch (err) {
      console.error("Remove password error:", err);
    } finally {
      setSavingEdit(false);
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

      {!features.publicSharingEnabled ? (
        <FeatureDisabledState />
      ) : loading ? (
        <TableCardSkeleton
          columns={[
            t("nameColumn"),
            t("typeColumn"),
            t("createdColumn"),
            t("expiresColumn"),
            t("protectionColumn"),
            t("actionsColumn"),
          ]}
        />
      ) : shares.length === 0 ? (
        <LayerCard className="p-0">
          <Empty
            size="sm"
            icon={<LinkIcon size={40} />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        </LayerCard>
      ) : (
        <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t("nameColumn")}</Table.Head>
                <Table.Head>{t("typeColumn")}</Table.Head>
                <Table.Head>{t("createdColumn")}</Table.Head>
                <Table.Head>{t("expiresColumn")}</Table.Head>
                <Table.Head>{t("protectionColumn")}</Table.Head>
                <Table.Head className="text-right">{t("actionsColumn")}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {shares.map((share) => (
                <Table.Row key={share.id}>
                  <Table.Cell>
                    <Text as="span" bold>{share.itemName}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{share.itemType === "folder" ? t("folder") : t("file")}</Badge>
                  </Table.Cell>
                  <Table.Cell>{new Date(share.createdAt).toLocaleDateString(locale)}</Table.Cell>
                  <Table.Cell>
                    {share.expiresAt ? (
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon size={14} />
                        {new Date(share.expiresAt).toLocaleString(locale)}
                      </span>
                    ) : (
                      <Text variant="secondary">{t("none")}</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {share.hasPassword ? (
                      <span className="inline-flex items-center gap-1">
                        <LockIcon size={14} /> {t("protected")}
                      </span>
                    ) : (
                      <Text variant="secondary">{t("none")}</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" icon={PencilSimpleIcon} onClick={() => openEdit(share)}>
                        {t("edit")}
                      </Button>
                      <Button variant="secondary" size="sm" icon={CopyIcon} onClick={() => handleCopy(share.token)}>
                        {t("copy")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revokingId === share.id}
                        icon={XCircleIcon}
                        onClick={() => setShareToRevoke(share)}
                      >
                        {t("revoke")}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}
      </div>

      {/* Modale d'édition d'un lien de partage */}
      <Dialog.Root open={editShare !== null} onOpenChange={(open) => !open && setEditShare(null)}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">
              {t("editDialogTitle", { name: editShare?.itemName ?? "" })}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} />
              )}
            />
          </div>

          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Text as="span" size="sm" bold>{t("expirationLabel")}</Text>
              <div className="flex items-center gap-2">
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <Popover.Trigger
                    render={
                      <Button variant="secondary" size="sm" icon={CalendarIcon}>
                        {editExpiresDate ? editExpiresDate.toLocaleDateString(locale) : t("noExpiration")}
                      </Button>
                    }
                  />
                  <Popover.Content className="p-2">
                    <DatePicker
                      mode="single"
                      selected={editExpiresDate}
                      onChange={(date) => {
                        setEditExpiresDate(date);
                        setIsDatePickerOpen(false);
                      }}
                      disabled={{ before: new Date() }}
                    />
                  </Popover.Content>
                </Popover>
                {editExpiresDate && (
                  <Button variant="ghost" size="sm" type="button" onClick={() => setEditExpiresDate(undefined)}>
                    {t("clear")}
                  </Button>
                )}
              </div>
              <Text as="span" size="sm" variant="secondary">
                {t("expirationHint")}
              </Text>
            </div>

            <div className="flex flex-col gap-1.5">
              <Input
                size="sm"
                type="password"
                label={editShare?.hasPassword ? t("newPasswordLabel") : t("passwordLabel")}
                description={editShare?.hasPassword ? t("passwordHintExisting") : t("passwordHintNew")}
                placeholder="••••••••"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
              {editShare?.hasPassword && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={savingEdit}
                  onClick={handleRemovePassword}
                  className="self-start"
                >
                  {t("removePassword")}
                </Button>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setEditShare(null)}>
                {t("cancel")}
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={savingEdit}>
                {savingEdit ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("saving")}
                  </span>
                ) : (
                  t("save")
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      <ConfirmDialog
        open={shareToRevoke !== null}
        onOpenChange={(open) => {
          if (!open && revokingId === null) setShareToRevoke(null);
        }}
        title={t("revokeTitle")}
        description={t("revokeDescription", { name: shareToRevoke?.itemName ?? "" })}
        confirmLabel={t("revokeConfirm")}
        onConfirm={handleRevoke}
        isConfirming={revokingId !== null}
      />
    </div>
  );
}
