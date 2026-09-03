"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs, Button, Empty, LayerCard, Loader, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { ArchiveIcon, ArrowCounterClockwiseIcon, XCircleIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ConfirmDialog } from "@/components/kumo/confirm-dialog";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { UserAvatar } from "@/components/files/user-avatar";
import { notifyStorageUpdated } from "@/lib/storage-events";
import { FeatureDisabledState } from "@/components/shell/coming-soon";
import { useInstanceFeatures } from "@/components/shell/instance-features";

type ArchivedItem = {
  id: string;
  archiveId: string;
  type: "file" | "folder";
  name: string;
  size: number | null;
  mimeType: string | null;
  archivedAt: string;
  owner: string;
  ownerId: string;
};

export default function ArchivePage() {
  const toasts = useKumoToastManager();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { features } = useInstanceFeatures();
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);
  const [actionId, setActionId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ArchivedItem | null>(null);
  const t = useTranslations("archivePage");
  const tToasts = useTranslations("archivePage.toasts");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();

  async function fetchArchive() {
    setLoading(true);
    try {
      const res = await fetch("/api/archive");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch (err) {
      console.error("Erreur chargement archive :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!features.archiveEnabled) {
      setLoading(false);
      return;
    }
    fetchArchive();
    fetch("/api/workspace/members")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCanManage(Boolean(data?.canManage)))
      .catch(() => setCanManage(false));
  }, [activeOrg?.id, features.archiveEnabled]);

  async function handleRestore(item: ArchivedItem) {
    setActionId(item.id);
    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: item.type, restore: true }),
      });
      if (res.ok) {
        toasts.add({
          title: tToasts("itemRestoredTitle"),
          description: tToasts("itemRestoredDescription", { name: item.name }),
        });
        fetchArchive();
      }
    } catch (err) {
      console.error("Restore error:", err);
    } finally {
      setActionId(null);
    }
  }

  async function handlePermanentDelete() {
    if (!itemToDelete) return;
    setActionId(itemToDelete.id);
    try {
      const res = await fetch(`/api/archive?id=${itemToDelete.id}&type=${itemToDelete.type}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({
          title: tToasts("permanentDeleteTitle"),
          description: tToasts("permanentDeleteDescription", { name: itemToDelete.name }),
        });
        setItemToDelete(null);
        fetchArchive();
        notifyStorageUpdated();
      }
    } catch (err) {
      console.error("Permanent delete error:", err);
    } finally {
      setActionId(null);
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
        {!features.archiveEnabled ? (
          <FeatureDisabledState />
        ) : loading ? (
          <TableCardSkeleton columns={[t("nameColumn"), t("ownerColumn"), t("archivedColumn"), " "]} />
        ) : items.length === 0 ? (
          <LayerCard className="p-0">
            <Empty
              size="sm"
              icon={<ArchiveIcon size={40} />}
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
                  <Table.Head>{t("ownerColumn")}</Table.Head>
                  <Table.Head>{t("archivedColumn")}</Table.Head>
                  <Table.Head></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>{item.name}</Table.Cell>
                    <Table.Cell>
                      <span className="flex items-center gap-2">
                        <UserAvatar userId={item.ownerId} name={item.owner} />
                        {item.owner}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{new Date(item.archivedAt).toLocaleDateString(locale)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={ArrowCounterClockwiseIcon}
                          disabled={actionId === item.id}
                          onClick={() => handleRestore(item)}
                        >
                          {actionId === item.id ? <Loader size="sm" /> : t("restore")}
                        </Button>
                        {canManage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={XCircleIcon}
                          disabled={actionId === item.id}
                          onClick={() => setItemToDelete(item)}
                        >
                          {t("delete")}
                        </Button>
                        ) : null}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </LayerCard>
        )}
      </div>

      <ConfirmDialog
        open={itemToDelete !== null}
        onOpenChange={(open) => {
          if (!open && actionId === null) setItemToDelete(null);
        }}
        title={t("deleteForeverTitle")}
        description={t("deleteForeverDescription", { name: itemToDelete?.name ?? "" })}
        confirmLabel={t("deleteForeverAction")}
        onConfirm={handlePermanentDelete}
        isConfirming={actionId !== null}
      />
    </div>
  );
}
