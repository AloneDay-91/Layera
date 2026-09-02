"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs, Empty, LayerCard, Table, Text } from "@cloudflare/kumo";
import { ShareIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
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
  usePageReady(!loading);
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
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {loading ? (
            <TableCardSkeleton
              columns={[tTable("name"), t("sharedByColumn"), tTable("modified"), tTable("size")]}
            />
          ) : items.length === 0 ? (
            <LayerCard className="p-0">
              <Empty
                size="sm"
                icon={<ShareIcon size={40} />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
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
