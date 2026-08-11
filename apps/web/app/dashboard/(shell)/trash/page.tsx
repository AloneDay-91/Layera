"use client";

import { useEffect, useState } from "react";
import { Badge, Breadcrumbs, Button, LayerCard, Loader, SkeletonLine, Table, Text, useKumoToastManager } from "@cloudflare/kumo";
import { TrashIcon, ArrowCounterClockwiseIcon, XCircleIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";

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
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

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
  }, []);

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
          title: "Élément restauré",
          description: `"${item.name}" a été restauré dans vos fichiers.`,
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
          title: "Suppression définitive",
          description: `"${item.name}" a été supprimé définitivement.`,
        });
        fetchTrash();
      }
    } catch (err) {
      console.error("Permanent delete error:", err);
    } finally {
      setActionId(null);
    }
  }

  async function handleEmptyTrash() {
    if (!confirm("Voulez-vous vraiment vider définitivement toute la corbeille ?")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/trash?empty=true", { method: "DELETE" });
      if (res.ok) {
        toasts.add({
          title: "Corbeille vidée",
          description: "Tous les éléments de la corbeille ont été supprimés.",
        });
        fetchTrash();
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
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Corbeille</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Corbeille"
        description="Les éléments placés dans la corbeille sont conservés pendant 30 jours avant leur purge définitive."
      >
        {items.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            icon={XCircleIcon}
            onClick={handleEmptyTrash}
          >
            Vider la corbeille
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
            La corbeille est vide
          </Text>
          <Text variant="secondary">
            Aucun fichier ni dossier n&apos;a été supprimé récemment.
          </Text>
        </LayerCard>
      ) : (
        <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Nom</Table.Head>
                <Table.Head>Type</Table.Head>
                <Table.Head>Date de suppression</Table.Head>
                <Table.Head>Expiration (30j)</Table.Head>
                <Table.Head className="text-right">Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <Text as="span" bold>{item.name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{item.type === "folder" ? "Dossier" : "Fichier"}</Badge>
                  </Table.Cell>
                  <Table.Cell>{new Date(item.deletedAt).toLocaleDateString("fr-FR")}</Table.Cell>
                  <Table.Cell>{new Date(item.purgeAt).toLocaleDateString("fr-FR")}</Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actionId === item.id}
                        icon={actionId === item.id ? undefined : ArrowCounterClockwiseIcon}
                        onClick={() => handleRestore(item)}
                      >
                        {actionId === item.id ? <Loader size="sm" /> : "Restaurer"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={actionId === item.id}
                        icon={XCircleIcon}
                        onClick={() => handlePermanentDelete(item)}
                      >
                        Supprimer
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
