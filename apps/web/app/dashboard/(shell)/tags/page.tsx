"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  DeleteResource,
  Dialog,
  Empty,
  Input,
  LayerCard,
  Loader,
  SkeletonLine,
  Table,
  Text,
  cn,
  useKumoToastManager,
} from "@cloudflare/kumo";
import type { BadgeVariant } from "@cloudflare/kumo";
import { PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";
import { TAG_COLOR_OPTIONS, type TagColorValue, type WorkspaceTag } from "@/lib/tags";

export default function TagsPage() {
  const toasts = useKumoToastManager();

  const [tags, setTags] = useState<WorkspaceTag[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColorValue>("neutral");
  const [creating, setCreating] = useState(false);

  const [editTag, setEditTag] = useState<WorkspaceTag | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<TagColorValue>("neutral");
  const [saving, setSaving] = useState(false);

  const [deleteTag, setDeleteTag] = useState<WorkspaceTag | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchTags() {
    setLoading(true);
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? []);
      }
    } catch (err) {
      console.error("Erreur de chargement des tags :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTags();
  }, []);

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        toasts.add({ title: "Tag créé", description: `Le tag "${newName.trim()}" a été créé.` });
        setNewName("");
        setNewColor("neutral");
        setIsCreateOpen(false);
        fetchTags();
      } else {
        const data = await res.json().catch(() => null);
        toasts.add({ title: "Erreur", description: data?.error ?? "Impossible de créer le tag." });
      }
    } catch (err) {
      console.error("Create tag error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de créer le tag." });
    } finally {
      setCreating(false);
    }
  }

  function openEditDialog(t: WorkspaceTag) {
    setEditTag(t);
    setEditName(t.name);
    setEditColor((t.color as TagColorValue) ?? "neutral");
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTag || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTag.id, name: editName.trim(), color: editColor }),
      });
      if (res.ok) {
        toasts.add({ title: "Tag mis à jour", description: `Le tag a été renommé en "${editName.trim()}".` });
        setEditTag(null);
        fetchTags();
      } else {
        const data = await res.json().catch(() => null);
        toasts.add({ title: "Erreur", description: data?.error ?? "Impossible de mettre à jour le tag." });
      }
    } catch (err) {
      console.error("Edit tag error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de mettre à jour le tag." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTag) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tags?id=${deleteTag.id}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({ title: "Tag supprimé", description: `"${deleteTag.name}" a été supprimé de l'espace.` });
        setDeleteTag(null);
        fetchTags();
      } else {
        toasts.add({ title: "Erreur", description: "Impossible de supprimer le tag." });
      }
    } catch (err) {
      console.error("Delete tag error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de supprimer le tag." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Tags"
        description="Créez, renommez et supprimez les tags disponibles dans cet espace de travail."
      >
        <Button variant="primary" size="sm" icon={PlusIcon} onClick={() => setIsCreateOpen(true)}>
          Nouveau tag
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col px-6 pb-6">
        {loading ? (
          <ClientOnly fallback={<div className="min-h-55 rounded-lg border border-kumo-line bg-kumo-base" />}>
            <div className="flex flex-col gap-3 rounded-lg border border-kumo-line bg-kumo-base p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between border-b border-kumo-line/40 py-3">
                  <SkeletonLine minWidth={20} maxWidth={30} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                  <SkeletonLine minWidth={10} maxWidth={15} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                </div>
              ))}
            </div>
          </ClientOnly>
        ) : tags.length === 0 ? (
          <div className="rounded-lg border border-kumo-line bg-kumo-base p-4">
            <Empty
              size="sm"
              icon={<TagIcon size={40} />}
              title="Aucun tag pour le moment"
              description="Créez votre premier tag pour commencer à organiser vos fichiers et dossiers."
              contents={
                <Button variant="secondary" size="sm" icon={PlusIcon} onClick={() => setIsCreateOpen(true)}>
                  Créer un tag
                </Button>
              }
            />
          </div>
        ) : (
          <LayerCard className="p-0">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Tag</Table.Head>
                  <Table.Head>Éléments</Table.Head>
                  <Table.Head className="text-right">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tags.map((t) => (
                  <Table.Row key={t.id}>
                    <Table.Cell>
                      <Badge variant={t.color as BadgeVariant}>{t.name}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text variant="secondary">
                        {t.itemCount ?? 0} élément{(t.itemCount ?? 0) === 1 ? "" : "s"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          shape="square"
                          size="sm"
                          icon={PencilSimpleIcon}
                          aria-label={`Modifier le tag "${t.name}"`}
                          onClick={() => openEditDialog(t)}
                        />
                        <Button
                          variant="ghost"
                          shape="square"
                          size="sm"
                          icon={TrashIcon}
                          aria-label={`Supprimer le tag "${t.name}"`}
                          onClick={() => setDeleteTag(t)}
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </LayerCard>
        )}
      </div>

      {/* Modale de création */}
      <Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Nouveau tag</Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
              )}
            />
          </div>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
            <Input
              size="sm"
              label="Nom du tag"
              placeholder="ex: Urgent"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
            />
            <div className="flex flex-col gap-1.5">
              <Text variant="secondary">Couleur</Text>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewColor(opt.value)}
                    aria-label={opt.label}
                    aria-pressed={newColor === opt.value}
                    className={cn(
                      "rounded-full border-0 bg-transparent p-0.5",
                      newColor === opt.value && "ring-2 ring-kumo-info",
                    )}
                  >
                    <Badge variant={opt.value}>{opt.label}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={creating || !newName.trim()}>
                {creating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Création…
                  </span>
                ) : (
                  "Créer le tag"
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      {/* Modale de modification */}
      <Dialog.Root open={editTag !== null} onOpenChange={(open) => !open && setEditTag(null)}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Modifier &quot;{editTag?.name}&quot;</Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
              )}
            />
          </div>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <Input
              size="sm"
              label="Nom du tag"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              autoFocus
            />
            <div className="flex flex-col gap-1.5">
              <Text variant="secondary">Couleur</Text>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditColor(opt.value)}
                    aria-label={opt.label}
                    aria-pressed={editColor === opt.value}
                    className={cn(
                      "rounded-full border-0 bg-transparent p-0.5",
                      editColor === opt.value && "ring-2 ring-kumo-info",
                    )}
                  >
                    <Badge variant={opt.value}>{opt.label}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setEditTag(null)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving || !editName.trim()}>
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Enregistrement…
                  </span>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      {/* Confirmation de suppression */}
      <DeleteResource
        open={deleteTag !== null}
        onOpenChange={(open) => !open && setDeleteTag(null)}
        resourceType="tag"
        resourceName={deleteTag?.name ?? ""}
        onDelete={handleDeleteConfirm}
        isDeleting={deleting}
        deleteButtonText="Supprimer le tag"
      />
    </div>
  );
}
