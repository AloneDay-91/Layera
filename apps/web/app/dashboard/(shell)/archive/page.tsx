"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs, Button, LayerCard, Loader, SkeletonLine, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { ArchiveIcon, ArrowCounterClockwiseIcon, XCircleIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";
import { UserAvatar } from "@/components/files/user-avatar";
import { notifyStorageUpdated } from "@/lib/storage-events";

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
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
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
    fetchArchive();
    fetch("/api/workspace/members")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCanManage(Boolean(data?.canManage)))
      .catch(() => setCanManage(false));
  }, [activeOrg?.id]);

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

  async function handlePermanentDelete(item: ArchivedItem) {
    setActionId(item.id);
    try {
      const res = await fetch(`/api/archive?id=${item.id}&type=${item.type}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({
          title: tToasts("permanentDeleteTitle"),
          description: tToasts("permanentDeleteDescription", { name: item.name }),
        });
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

      <div className="flex flex-1 flex-col gap-6 max-w-5xl pt-6">
        {loading ? (
          <ClientOnly fallback={<div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg animate-pulse min-h-55" />}>
            <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-kumo-line/40">
                  <SkeletonLine minWidth={40} maxWidth={60} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                  <SkeletonLine minWidth={20} maxWidth={20} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                </div>
              ))}
            </div>
          </ClientOnly>
        ) : items.length === 0 ? (
          <LayerCard className="flex flex-col items-center justify-center p-12 text-center">
            <ArchiveIcon size={48} className="text-kumo-subtle mb-3" />
            <Text as="p" variant="heading3" DANGEROUS_className="mb-1">
              {t("emptyTitle")}
            </Text>
            <Text variant="secondary">{t("emptyDescription")}</Text>
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
                          onClick={() => handlePermanentDelete(item)}
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
    </div>
  );
}
