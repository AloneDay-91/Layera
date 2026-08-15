"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Checkbox, Dialog, Input, Loader, SkeletonLine, Text, cn } from "@cloudflare/kumo";
import type { BadgeVariant } from "@cloudflare/kumo";
import { PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import type { FileItem } from "@/lib/file-item";
import { ClientOnly } from "@/components/shell/client-only";
import { TAG_COLOR_OPTIONS, type TagColorValue, type WorkspaceTag } from "@/lib/tags";

type ManageTagsDialogProps = {
  item: FileItem | null;
  workspaceTags: WorkspaceTag[];
  loading?: boolean;
  onClose: () => void;
  onToggleTag: (tag: WorkspaceTag) => void;
  onCreateTag: (name: string, color: TagColorValue) => Promise<void>;
  onDeleteTag: (tag: WorkspaceTag) => void;
};

export function ManageTagsDialog({
  item,
  workspaceTags,
  loading,
  onClose,
  onToggleTag,
  onCreateTag,
  onDeleteTag,
}: ManageTagsDialogProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColorValue>("neutral");
  const [creating, setCreating] = useState(false);
  const t = useTranslations("manageTagsDialog");
  const tColors = useTranslations("tagColors");

  const assignedIds = new Set((item?.tags ?? []).map((t) => t.id));

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreateTag(newName.trim(), newColor);
      setNewName("");
      setNewColor("neutral");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog.Root open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Dialog.Title className="text-lg font-semibold">{t("title", { name: item?.name ?? "" })}</Dialog.Title>
          <Dialog.Close
            aria-label={t("close")}
            render={(props) => (
              <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} />
            )}
          />
        </div>

        <div className="flex flex-col gap-4">
          {loading ? (
            <ClientOnly
              fallback={
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-6 w-2/3 animate-pulse rounded bg-kumo-tint" />
                  ))}
                </div>
              }
            >
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonLine
                    key={index}
                    minWidth={40}
                    maxWidth={70}
                    minDuration={1.5}
                    maxDuration={1.5}
                    minDelay={0}
                    maxDelay={0}
                    className="h-5"
                  />
                ))}
              </div>
            </ClientOnly>
          ) : workspaceTags.length === 0 ? (
            <Text variant="secondary">{t("noTags")}</Text>
          ) : (
            <div className="flex flex-col gap-1.5">
              {workspaceTags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between gap-2">
                  <Checkbox
                    label={<Badge variant={tag.color as BadgeVariant}>{tag.name}</Badge>}
                    checked={assignedIds.has(tag.id)}
                    onCheckedChange={() => onToggleTag(tag)}
                  />
                  <Button
                    variant="ghost"
                    shape="square"
                    size="sm"
                    icon={TrashIcon}
                    aria-label={t("deleteTagAria", { name: tag.name })}
                    onClick={() => onDeleteTag(tag)}
                  />
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3 border-t border-kumo-line pt-4">
            <Input
              size="sm"
              label={t("newTagLabel")}
              placeholder={t("newTagPlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
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
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" type="submit" icon={PlusIcon} disabled={creating || !newName.trim()}>
                {creating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("creating")}
                  </span>
                ) : (
                  t("createTag")
                )}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
