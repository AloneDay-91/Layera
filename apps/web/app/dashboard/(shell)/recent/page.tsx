"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs, Button, Dialog, Empty, Input, LayerCard, Loader, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { ClockIcon, CopyIcon, XIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { FilePreviewIcon } from "@/components/files/file-preview";
import { FileRowMenu } from "@/components/files/file-row-menu";
import { FileDetailsPanel } from "@/components/files/file-details-panel";
import { formatFileSize, type FileItem } from "@/lib/file-item";

type RecentItem = FileItem & { location: string };

export default function RecentPage() {
  const toasts = useKumoToastManager();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [shareItem, setShareItem] = useState<FileItem | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const t = useTranslations("recentPage");
  const tToasts = useTranslations("recentPage.toasts");
  const tBrowser = useTranslations("fileBrowser");
  const tBrowserToasts = useTranslations("fileBrowser.toasts");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const tSidebar = useTranslations("sidebar");
  const tTable = useTranslations("fileTable");
  const locale = useLocale();

  async function fetchRecent() {
    setLoading(true);
    try {
      const res = await fetch("/api/files/recent");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch (err) {
      console.error("Erreur chargement des fichiers récents :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecent();
  }, [activeOrg?.id]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  async function handleDeleteItem(item: FileItem) {
    try {
      const res = await fetch(`/api/files?id=${item.id}&type=${item.type}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({ title: tToasts("itemDeletedTitle"), description: tToasts("itemDeletedDescription", { name: item.name }) });
        if (selectedItemId === item.id) setSelectedItemId(null);
        fetchRecent();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  async function handleShareItem(item: FileItem) {
    setShareItem(item);
    setShareUrl(null);
    setSharing(true);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemType: item.type }),
      });
      if (res.ok) {
        const data = await res.json();
        setShareUrl(`${window.location.origin}${data.share.url}`);
      } else {
        toasts.add({ title: tBrowserToasts("genericError"), description: tBrowserToasts("shareErrorDescription") });
        setShareItem(null);
      }
    } catch (err) {
      console.error("Share error:", err);
      setShareItem(null);
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toasts.add({ title: tBrowserToasts("linkCopiedTitle"), description: tBrowserToasts("linkCopiedDescription") });
  }

  function handleDetailAction(action: string) {
    toasts.add({ title: tBrowserToasts("fileActionTitle"), description: tBrowserToasts("fileActionDescription", { action }) });
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">{tBreadcrumbs("myFiles")}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>{tSidebar("recent")}</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title={t("title")}
        description={t("description")}
      />

      <div className="flex flex-1 gap-6 pt-6">
      <div className="flex min-w-0 flex-1 flex-col gap-6">

        {loading ? (
          <TableCardSkeleton
            columns={[tTable("name"), t("locationColumn"), t("modifiedColumn"), t("sizeColumn"), " "]}
          />
        ) : items.length === 0 ? (
          <LayerCard className="p-0">
            <Empty
              size="sm"
              icon={<ClockIcon size={40} />}
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
                  <Table.Head>{t("locationColumn")}</Table.Head>
                  <Table.Head>{t("modifiedColumn")}</Table.Head>
                  <Table.Head>{t("sizeColumn")}</Table.Head>
                  <Table.Head></Table.Head>
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
                    <Table.Cell>{item.location}</Table.Cell>
                    <Table.Cell>{new Date(item.updatedAt).toLocaleDateString(locale)}</Table.Cell>
                    <Table.Cell>{formatFileSize(item.size)}</Table.Cell>
                    <Table.Cell>
                      <FileRowMenu item={item} onShare={handleShareItem} onDelete={handleDeleteItem} />
                    </Table.Cell>
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
          onAction={handleDetailAction}
          onShare={handleShareItem}
        />
      )}
      </div>

      <Dialog.Root open={shareItem !== null} onOpenChange={(open) => !open && setShareItem(null)}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{tBrowser("shareTitle", { name: shareItem?.name ?? "" })}</Dialog.Title>
            <Dialog.Close
              aria-label={tBrowser("close")}
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={tBrowser("close")} />
              )}
            />
          </div>

          {sharing ? (
            <div className="flex items-center gap-2 py-4">
              <Loader size="sm" /> {tBrowser("creatingLink")}
            </div>
          ) : shareUrl ? (
            <div className="flex flex-col gap-4">
              <Input size="sm" label={tBrowser("shareLinkLabel")} value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShareItem(null)}>
                  {tBrowser("close")}
                </Button>
                <Button variant="primary" size="sm" icon={CopyIcon} onClick={handleCopyShareUrl}>
                  {tBrowser("copyLink")}
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
