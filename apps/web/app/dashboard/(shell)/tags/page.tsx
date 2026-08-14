"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";
import { TAG_COLOR_OPTIONS, type TagColorValue, type WorkspaceTag } from "@/lib/tags";

export default function TagsPage() {
  const toasts = useKumoToastManager();
  const { data: activeOrg } = authClient.useActiveOrganization();

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

  const t = useTranslations("tagsPage");
  const tToasts = useTranslations("tagsPage.toasts");
  const tColors = useTranslations("tagColors");

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
  }, [activeOrg?.id]);

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
        toasts.add({ title: tToasts("tagCreatedTitle"), description: tToasts("tagCreatedDescription", { name: newName.trim() }) });
        setNewName("");
        setNewColor("neutral");
        setIsCreateOpen(false);
        fetchTags();
      } else {
        const data = await res.json().catch(() => null);
        toasts.add({ title: tToasts("genericError"), description: data?.error ?? tToasts("tagCreateErrorDescription") });
      }
    } catch (err) {
      console.error("Create tag error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("tagCreateErrorDescription") });
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
        toasts.add({ title: tToasts("tagUpdatedTitle"), description: tToasts("tagUpdatedDescription", { name: editName.trim() }) });
        setEditTag(null);
        fetchTags();
      } else {
        const data = await res.json().catch(() => null);
        toasts.add({ title: tToasts("genericError"), description: data?.error ?? tToasts("tagUpdateErrorDescription") });
      }
    } catch (err) {
      console.error("Edit tag error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("tagUpdateErrorDescription") });
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
        toasts.add({ title: tToasts("tagDeletedTitle"), description: tToasts("tagDeletedDescription", { name: deleteTag.name }) });
        setDeleteTag(null);
        fetchTags();
      } else {
        toasts.add({ title: tToasts("genericError"), description: tToasts("tagDeleteErrorDescription") });
      }
    } catch (err) {
      console.error("Delete tag error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("tagDeleteErrorDescription") });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <Button variant="primary" size="sm" icon={PlusIcon} onClick={() => setIsCreateOpen(true)}>
          {t("newTag")}
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
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              contents={
                <Button variant="secondary" size="sm" icon={PlusIcon} onClick={() => setIsCreateOpen(true)}>
                  {t("createTag")}
                </Button>
              }
            />
          </div>
        ) : (
          <LayerCard className="p-0">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>{t("tagColumn")}</Table.Head>
                  <Table.Head>{t("itemsColumn")}</Table.Head>
                  <Table.Head className="text-right">{t("actionsColumn")}</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tags.map((tag) => (
                  <Table.Row key={tag.id}>
                    <Table.Cell>
                      <Badge variant={tag.color as BadgeVariant}>{tag.name}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text variant="secondary">{t("itemCount", { count: tag.itemCount ?? 0 })}</Text>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          shape="square"
                          size="sm"
                          icon={PencilSimpleIcon}
                          aria-label={t("editTagAria", { name: tag.name })}
                          onClick={() => openEditDialog(tag)}
                        />
                        <Button
                          variant="ghost"
                          shape="square"
                          size="sm"
                          icon={TrashIcon}
                          aria-label={t("deleteTagAria", { name: tag.name })}
                          onClick={() => setDeleteTag(tag)}
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
            <Dialog.Title className="text-lg font-semibold">{t("createDialogTitle")}</Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} />
              )}
            />
          </div>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
            <Input
              size="sm"
              label={t("tagNameLabel")}
              placeholder={t("tagNamePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
            />
            <div className="flex flex-col gap-1.5">
              <Text variant="secondary">{t("colorLabel")}</Text>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewColor(opt.value)}
                    aria-label={tColors(opt.value)}
                    aria-pressed={newColor === opt.value}
                    className={cn(
                      "rounded-full border-0 bg-transparent p-0.5",
                      newColor === opt.value && "ring-2 ring-kumo-info",
                    )}
                  >
                    <Badge variant={opt.value}>{tColors(opt.value)}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                {t("cancel")}
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={creating || !newName.trim()}>
                {creating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("creating")}
                  </span>
                ) : (
                  t("createTagButton")
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
            <Dialog.Title className="text-lg font-semibold">{t("editDialogTitle", { name: editTag?.name ?? "" })}</Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} />
              )}
            />
          </div>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <Input
              size="sm"
              label={t("tagNameLabel")}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              autoFocus
            />
            <div className="flex flex-col gap-1.5">
              <Text variant="secondary">{t("colorLabel")}</Text>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditColor(opt.value)}
                    aria-label={tColors(opt.value)}
                    aria-pressed={editColor === opt.value}
                    className={cn(
                      "rounded-full border-0 bg-transparent p-0.5",
                      editColor === opt.value && "ring-2 ring-kumo-info",
                    )}
                  >
                    <Badge variant={opt.value}>{tColors(opt.value)}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setEditTag(null)}>
                {t("cancel")}
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving || !editName.trim()}>
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("saving")}
                  </span>
                ) : (
                  t("save")
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
        deleteButtonText={t("deleteButtonText")}
      />
    </div>
  );
}
