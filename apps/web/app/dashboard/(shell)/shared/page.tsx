"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs, LayerCard, SkeletonLine, Table, Text } from "@cloudflare/kumo";
import { ShareIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";
import { FilePreviewIcon } from "@/components/files/file-preview";
import { FileDetailsPanel } from "@/components/files/file-details-panel";
import { UserAvatar } from "@/components/files/user-avatar";
import { formatFileSize, type FileItem } from "@/lib/file-item";

type SharedItem = FileItem & { shareId: string; workspaceId: string };

export default function SharedPage() {
  const t = useTranslations("sharedPage");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const tTable = useTranslations("fileTable");
  const locale = useLocale();
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/item-shares?mine=true")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">{tBreadcrumbs("myFiles")}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>{t("breadcrumb")}</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title={t("breadcrumb")}
        description={t("description")}
      />

      <div className="flex flex-1 gap-6 pt-6">
        <div className="flex flex-1 flex-col gap-6 max-w-5xl">
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
              <ShareIcon size={48} className="text-kumo-subtle mb-3" />
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
                    <Table.Head>{tTable("name")}</Table.Head>
                    <Table.Head>{t("sharedByColumn")}</Table.Head>
                    <Table.Head>{tTable("modified")}</Table.Head>
                    <Table.Head>{tTable("size")}</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {items.map((item) => (
                    <Table.Row key={item.id} variant={selectedItemId === item.id ? "selected" : "default"}>
                      <Table.Cell>
                        <button
                          type="button"
                          onClick={() => setSelectedItemId(selectedItemId === item.id ? null : item.id)}
                          className="flex items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-kumo-default hover:text-kumo-strong hover:underline"
                        >
                          <FilePreviewIcon item={item} />
                          {item.name}
                        </button>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="flex items-center gap-2">
                          <UserAvatar userId={item.sharedBy?.id ?? item.ownerId} name={item.sharedBy?.name ?? item.owner} />
                          {item.sharedBy?.name ?? item.owner}
                        </span>
                      </Table.Cell>
                      <Table.Cell>{new Date(item.updatedAt).toLocaleDateString(locale)}</Table.Cell>
                      <Table.Cell>{formatFileSize(item.size)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard>
          )}
        </div>
        {selectedItem && (
          <FileDetailsPanel
            item={selectedItem}
            onClose={() => setSelectedItemId(null)}
            onAction={() => undefined}
          />
        )}
      </div>
    </div>
  );
}
