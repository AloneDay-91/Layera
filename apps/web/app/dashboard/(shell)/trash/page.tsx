"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Breadcrumbs, Button, LayerCard, Loader, SkeletonLine, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { TrashIcon, ArrowCounterClockwiseIcon, XCircleIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";
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
  const [actionId, setActionId] = useState<string | null>(null);
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

  async function handlePermanentDelete(item: TrashedItem) {
    setActionId(item.id);
    try {
      const res = await fetch(`/api/trash?id=${item.id}&type=${item.type}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toasts.add({
          title: tToasts("permanentDeleteTitle"),
          description: tToasts("permanentDeleteDescription", { name: item.name }),
        });
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
    if (!confirm(t("emptyConfirm"))) return;

    setLoading(true);
    try {
      const res = await fetch("/api/trash?empty=true", { method: "DELETE" });
      if (res.ok) {
        toasts.add({
          title: tToasts("trashEmptiedTitle"),
          description: tToasts("trashEmptiedDescription"),
        });
        fetchTrash();
        notifyStorageUpdated();
      }
    } catch (err) {
      console.error("Empty trash error:", err);
    } finally {
      setLoading(false);
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
        {items.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            icon={XCircleIcon}
            onClick={handleEmptyTrash}
          >
            {t("emptyTrash")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-1 flex-col gap-6 max-w-5xl pt-6">

      {loading ? (
        <ClientOnly
          fallback={
            <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg animate-pulse min-h-55" />
          }
        >
          <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-kumo-line/40">
                <SkeletonLine minWidth={40} maxWidth={60} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                <SkeletonLine minWidth={20} maxWidth={20} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
              </div>
            ))}
          </div>
        </ClientOnly>
      ) : items.length === 0 ? (
        <LayerCard className="flex flex-col items-center justify-center p-12 text-center">
          <TrashIcon size={48} className="text-kumo-subtle mb-3" />
          <Text as="p" variant="heading3" DANGEROUS_className="mb-1">
            {t("emptyStateTitle")}
          </Text>
          <Text variant="secondary">
            {t("emptyStateDescription")}
          </Text>
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
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={actionId === item.id}
                        icon={XCircleIcon}
                        onClick={() => handlePermanentDelete(item)}
                      >
                        {t("delete")}
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
    </div>
  );
}
