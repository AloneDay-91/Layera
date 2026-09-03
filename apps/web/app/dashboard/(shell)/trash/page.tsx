"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Breadcrumbs, Button, Empty, LayerCard, Loader, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { TrashIcon, ArrowCounterClockwiseIcon, XCircleIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ConfirmDialog } from "@/components/kumo/confirm-dialog";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { notifyStorageUpdated } from "@/lib/storage-events";

type TrashedItem = {
  id: string;
  trashId: string;
  type: "file" | "folder";
  name: string;
  size: number | null;
  mimeType: string | null;
  deletedAt: string;
  purgeAt: string;
  owner: string;
};

export default function TrashPage() {
  const toasts = useKumoToastManager();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);
  const [actionId, setActionId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TrashedItem | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const t = useTranslations("trashPage");
  const tToasts = useTranslations("trashPage.toasts");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();

  async function fetchTrash() {
    setLoading(true);
    try {
      const res = await fetch("/api/trash");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch (err) {
      console.error("Erreur chargement corbeille :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrash();
    fetch("/api/workspace/members")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCanManage(Boolean(data?.canManage)))
      .catch(() => setCanManage(false));
  }, [activeOrg?.id]);

  async function handleRestore(item: TrashedItem) {
    setActionId(item.id);
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: item.type }),
      });
      if (res.ok) {
        toasts.add({
          title: tToasts("itemRestoredTitle"),
          description: tToasts("itemRestoredDescription", { name: item.name }),
        });
        fetchTrash();
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
      const res = await fetch(`/api/trash?id=${itemToDelete.id}&type=${itemToDelete.type}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toasts.add({
          title: tToasts("permanentDeleteTitle"),
          description: tToasts("permanentDeleteDescription", { name: itemToDelete.name }),
        });
        setItemToDelete(null);
        fetchTrash();
        notifyStorageUpdated();
      }
    } catch (err) {
      console.error("Permanent delete error:", err);
    } finally {
      setActionId(null);
    }
  }

  async function handleEmptyTrash() {
    setEmptying(true);
    try {
      const res = await fetch("/api/trash?empty=true", { method: "DELETE" });
      if (res.ok) {
        toasts.add({
          title: tToasts("trashEmptiedTitle"),
          description: tToasts("trashEmptiedDescription"),
        });
        setEmptyOpen(false);
        fetchTrash();
        notifyStorageUpdated();
      }
    } catch (err) {
      console.error("Empty trash error:", err);
    } finally {
      setEmptying(false);
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
      >
        {canManage && items.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            icon={XCircleIcon}
            onClick={() => setEmptyOpen(true)}
          >
            {t("emptyTrash")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-1 flex-col gap-6 pt-6">

      {loading ? (
        <TableCardSkeleton
          columns={[t("nameColumn"), t("typeColumn"), t("deletedColumn"), t("expiresColumn"), t("actionsColumn")]}
        />
      ) : items.length === 0 ? (
        <LayerCard className="p-0">
          <Empty
            size="sm"
            icon={<TrashIcon size={40} />}
            title={t("emptyStateTitle")}
            description={t("emptyStateDescription")}
          />
        </LayerCard>
      ) : (
        <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t("nameColumn")}</Table.Head>
                <Table.Head>{t("typeColumn")}</Table.Head>
                <Table.Head>{t("deletedColumn")}</Table.Head>
                <Table.Head>{t("expiresColumn")}</Table.Head>
                <Table.Head className="text-right">{t("actionsColumn")}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <Text as="span" bold>{item.name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{item.type === "folder" ? t("folder") : t("file")}</Badge>
                  </Table.Cell>
                  <Table.Cell>{new Date(item.deletedAt).toLocaleDateString(locale)}</Table.Cell>
                  <Table.Cell>{new Date(item.purgeAt).toLocaleDateString(locale)}</Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actionId === item.id}
                        icon={actionId === item.id ? undefined : ArrowCounterClockwiseIcon}
                        onClick={() => handleRestore(item)}
                      >
                        {actionId === item.id ? <Loader size="sm" /> : t("restore")}
                      </Button>
                      {canManage ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={actionId === item.id}
                        icon={XCircleIcon}
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

      <ConfirmDialog
        open={emptyOpen}
        onOpenChange={(open) => {
          if (!emptying) setEmptyOpen(open);
        }}
        title={t("emptyConfirmTitle")}
        description={t("emptyConfirm")}
        confirmLabel={t("emptyConfirmAction")}
        onConfirm={handleEmptyTrash}
        isConfirming={emptying}
      />
    </div>
  );
}
