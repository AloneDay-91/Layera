"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs, Empty, LayerCard, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { PushPinIcon, StarIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { FilePreviewIcon } from "@/components/files/file-preview";
import { FileRowMenu } from "@/components/files/file-row-menu";
import { FileDetailsPanel } from "@/components/files/file-details-panel";
import { ItemShareDialog } from "@/components/files/item-share-dialog";
import { formatFileSize, type FileItem } from "@/lib/file-item";

type FavoriteItem = FileItem & { location: string; isPinned?: boolean };

export default function FavoritesPage() {
  const toasts = useKumoToastManager();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [shareItem, setShareItem] = useState<FileItem | null>(null);

  const t = useTranslations("favoritesPage");
  const tToasts = useTranslations("favoritesPage.toasts");
  const tBrowserToasts = useTranslations("fileBrowser.toasts");
  const tTable = useTranslations("fileTable");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();

  async function fetchFavorites() {
    setLoading(true);
    try {
      const res = await fetch("/api/favorites");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch (err) {
      console.error("Erreur chargement des favoris :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFavorites();
  }, [activeOrg?.id]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  async function handlePin(item: FileItem) {
    const nextPinned = !item.isPinned;
    setItems((prev) =>
      [...prev.map((i) => (i.id === item.id ? { ...i, isPinned: nextPinned } : i))].sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
        return 0;
      }),
    );
    try {
      const res = await fetch("/api/favorites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, pinned: nextPinned }),
      });
      if (!res.ok) throw new Error("Failed to pin favorite");
      toasts.add({
        title: nextPinned ? tToasts("pinnedTitle") : tToasts("unpinnedTitle"),
        description: nextPinned
          ? tToasts("pinnedDescription", { name: item.name })
          : tToasts("unpinnedDescription", { name: item.name }),
      });
    } catch (err) {
      console.error("Pin favorite error:", err);
      fetchFavorites();
    }
  }

  async function handleToggleFavorite(item: FileItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (selectedItemId === item.id) setSelectedItemId(null);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: item.type }),
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      toasts.add({ title: tToasts("removedTitle"), description: tToasts("removedDescription", { name: item.name }) });
    } catch (err) {
      console.error("Toggle favorite error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("removeErrorDescription") });
      fetchFavorites();
    }
  }

  async function handleDeleteItem(item: FileItem) {
    try {
      const res = await fetch(`/api/files?id=${item.id}&type=${item.type}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({ title: tToasts("itemDeletedTitle"), description: tToasts("itemDeletedDescription", { name: item.name }) });
        if (selectedItemId === item.id) setSelectedItemId(null);
        fetchFavorites();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  function handleShareItem(item: FileItem) {
    setShareItem(item);
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
            <Breadcrumbs.Current>{t("title")}</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title={t("title")}
        description={t("description")}
      />

      <div className="flex flex-1 gap-6 pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {loading ? (
            <TableCardSkeleton
              columns={[
                " ",
                t("nameColumn"),
                t("locationColumn"),
                t("modifiedColumn"),
                t("sizeColumn"),
                " ",
              ]}
            />
          ) : items.length === 0 ? (
            <LayerCard className="p-0">
              <Empty
                size="sm"
                icon={<StarIcon size={40} />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            </LayerCard>
          ) : (
            <LayerCard className="p-0">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head></Table.Head>
                    <Table.Head>{t("nameColumn")}</Table.Head>
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePin(item);
                            }}
                            aria-label={item.isPinned ? t("unpinAria", { name: item.name }) : t("pinAria", { name: item.name })}
                            aria-pressed={item.isPinned}
                            className="flex items-center justify-center border-0 bg-transparent p-1"
                          >
                            <PushPinIcon
                              size={16}
                              weight={item.isPinned ? "fill" : "regular"}
                              className={item.isPinned ? "text-kumo-info" : "text-kumo-subtle"}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(item);
                            }}
                            aria-label={tTable("removeFavorite", { name: item.name })}
                            aria-pressed
                            className="flex items-center justify-center border-0 bg-transparent p-1"
                          >
                            <StarIcon size={16} weight="fill" className="text-kumo-info" />
                          </button>
                        </div>
                      </Table.Cell>
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
                        <FileRowMenu
                          item={item}
                          onShare={handleShareItem}
                          onDelete={handleDeleteItem}
                          onToggleFavorite={handleToggleFavorite}
                          onPin={handlePin}
                        />
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
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </div>

      <ItemShareDialog item={shareItem} onClose={() => setShareItem(null)} />
    </div>
  );
}
