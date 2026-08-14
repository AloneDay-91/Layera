"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs, Button, Dialog, Input, LayerCard, Loader, SkeletonLine, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { CopyIcon, StarIcon, XIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";
import { FilePreviewIcon } from "@/components/files/file-preview";
import { FileRowMenu } from "@/components/files/file-row-menu";
import { FileDetailsPanel } from "@/components/files/file-details-panel";
import { formatFileSize, type MockItem } from "@/lib/mock-files";

type FavoriteItem = MockItem & { location: string };

export default function FavoritesPage() {
  const toasts = useKumoToastManager();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [shareItem, setShareItem] = useState<MockItem | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

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

  async function handleToggleFavorite(item: MockItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (selectedItemId === item.id) setSelectedItemId(null);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: item.type }),
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      toasts.add({ title: "Retiré des favoris", description: `"${item.name}" a été retiré de vos favoris.` });
    } catch (err) {
      console.error("Toggle favorite error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de retirer cet élément des favoris." });
      fetchFavorites();
    }
  }

  async function handleDeleteItem(item: MockItem) {
    try {
      const res = await fetch(`/api/files?id=${item.id}&type=${item.type}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({ title: "Élément supprimé", description: `"${item.name}" a été déplacé dans la corbeille.` });
        if (selectedItemId === item.id) setSelectedItemId(null);
        fetchFavorites();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  async function handleShareItem(item: MockItem) {
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
        toasts.add({ title: "Erreur", description: "Impossible de créer le lien de partage." });
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
    toasts.add({ title: "Lien copié", description: "Le lien de partage a été copié dans le presse-papiers." });
  }

  function handleDetailAction(action: string) {
    toasts.add({ title: "Action sur le fichier", description: `Action "${action}" exécutée sur le fichier.` });
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Favoris</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Favoris"
        description="Les fichiers et dossiers que vous avez marqués comme favoris."
      />

      <div className="flex flex-1 gap-6 pt-6">
        <div className="flex flex-1 flex-col gap-6 max-w-5xl">
          {loading ? (
            <ClientOnly
              fallback={
                <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg animate-pulse min-h-55" />
              }
            >
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
              <StarIcon size={48} className="text-kumo-subtle mb-3" />
              <Text as="p" variant="heading3" DANGEROUS_className="mb-1">
                Aucun favori
              </Text>
              <Text variant="secondary">Marquez des fichiers ou dossiers comme favoris pour les retrouver ici.</Text>
            </LayerCard>
          ) : (
            <LayerCard className="p-0">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head></Table.Head>
                    <Table.Head>Nom</Table.Head>
                    <Table.Head>Emplacement</Table.Head>
                    <Table.Head>Modifié</Table.Head>
                    <Table.Head>Taille</Table.Head>
                    <Table.Head></Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {items.map((item) => (
                    <Table.Row key={item.id} variant={selectedItemId === item.id ? "selected" : "default"}>
                      <Table.Cell>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(item);
                          }}
                          aria-label={`Retirer "${item.name}" des favoris`}
                          aria-pressed
                          className="flex items-center justify-center border-0 bg-transparent p-1"
                        >
                          <StarIcon size={16} weight="fill" className="text-kumo-info" />
                        </button>
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
                      <Table.Cell>{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</Table.Cell>
                      <Table.Cell>{formatFileSize(item.size)}</Table.Cell>
                      <Table.Cell>
                        <FileRowMenu
                          item={item}
                          onShare={handleShareItem}
                          onDelete={handleDeleteItem}
                          onToggleFavorite={handleToggleFavorite}
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

      <Dialog.Root open={shareItem !== null} onOpenChange={(open) => !open && setShareItem(null)}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Partager &quot;{shareItem?.name}&quot;</Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
              )}
            />
          </div>

          {sharing ? (
            <div className="flex items-center gap-2 py-4">
              <Loader size="sm" /> Création du lien…
            </div>
          ) : shareUrl ? (
            <div className="flex flex-col gap-4">
              <Input size="sm" label="Lien de partage public" value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShareItem(null)}>
                  Fermer
                </Button>
                <Button variant="primary" size="sm" icon={CopyIcon} onClick={handleCopyShareUrl}>
                  Copier le lien
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
