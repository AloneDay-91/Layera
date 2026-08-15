"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, DropdownMenu, LayerCard, Table, cn } from "@cloudflare/kumo";
import type { BadgeVariant } from "@cloudflare/kumo";
import { CaretDownIcon, StarIcon, XCircleIcon } from "@phosphor-icons/react";
import type { FileItem } from "@/lib/file-item";
import { formatFileSize } from "@/lib/file-item";
import type { WorkspaceTag } from "@/lib/tags";
import { FilePreviewIcon, getFileTypeLabel } from "./file-preview";
import { FileRowMenu } from "./file-row-menu";
import { TagBadgeList } from "./tag-badge-list";
import { UserAvatar } from "./user-avatar";

export type TypeFilterValue = "all" | "folder" | "file";

type FileTableProps = {
  items: FileItem[];
  selectedItemId: string | null;
  onOpenFolder: (folderId: string) => void;
  onSelectItem: (itemId: string | null) => void;
  onRenameItem?: (item: FileItem) => void;
  onShareItem?: (item: FileItem) => void;
  onDeleteItem?: (item: FileItem) => void;
  onToggleFavorite?: (item: FileItem) => void;
  onManageTags?: (item: FileItem) => void;
  onChangeColor?: (item: FileItem) => void;
  onDownloadZip?: (item: FileItem) => void;
  onExtractZip?: (item: FileItem) => void;
  onArchive?: (item: FileItem) => void;
  onTransfer?: (item: FileItem) => void;
  onMoveItem?: (draggedItem: { id: string; type: "file" | "folder"; name: string }, targetFolderId: string) => void;
  selectedIds?: Set<string>;
  onToggleSelectItem?: (id: string) => void;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleSelectAll?: () => void;
  typeFilter?: TypeFilterValue;
  onTypeFilterChange?: (value: TypeFilterValue) => void;
  workspaceTags?: WorkspaceTag[];
  tagFilterIds?: Set<string>;
  onToggleTagFilter?: (tagId: string) => void;
  onClearTagFilter?: () => void;
};

function HeaderFilterButton({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-left hover:text-kumo-strong",
            active && "text-kumo-info",
          )}
        >
          {label}
          <CaretDownIcon size={11} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>{children}</DropdownMenu.Content>
    </DropdownMenu>
  );
}

export function FileTable({
  items,
  selectedItemId,
  onOpenFolder,
  onSelectItem,
  onRenameItem,
  onShareItem,
  onDeleteItem,
  onToggleFavorite,
  onManageTags,
  onChangeColor,
  onDownloadZip,
  onExtractZip,
  onArchive,
  onTransfer,
  onMoveItem,
  selectedIds,
  onToggleSelectItem,
  allSelected,
  someSelected,
  onToggleSelectAll,
  typeFilter = "all",
  onTypeFilterChange,
  workspaceTags = [],
  tagFilterIds,
  onToggleTagFilter,
  onClearTagFilter,
}: FileTableProps) {
  const t = useTranslations("fileTable");
  const tFileType = useTranslations("filePreview");
  const locale = useLocale();
  const showSelection = Boolean(onToggleSelectItem);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  function handleActivate(item: FileItem) {
    if (item.type === "folder") {
      onOpenFolder(item.id);
    } else {
      onSelectItem(selectedItemId === item.id ? null : item.id);
    }
  }

  function handleDragStart(e: React.DragEvent, item: FileItem) {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ id: item.id, type: item.type, name: item.name }),
    );
  }

  function handleDropOnFolder(e: React.DragEvent, targetFolderId: string) {
    e.preventDefault();
    setDragOverFolderId(null);
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;
    try {
      const dragged = JSON.parse(dataStr);
      if (dragged.id && dragged.id !== targetFolderId && onMoveItem) {
        onMoveItem(dragged, targetFolderId);
      }
    } catch (err) {
      console.error("Error parsing dragged item payload:", err);
    }
  }

  return (
    <LayerCard className="p-0 ring-1 ring-kumo-fill border border-kumo-line">
      <div className="overflow-x-auto">
        <Table className="min-w-208">
          <Table.Header>
            <Table.Row>
              {showSelection && (
                <Table.CheckHead
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onCheckedChange={onToggleSelectAll}
                  aria-label={t("selectAll")}
                />
              )}
              <Table.Head></Table.Head>
              <Table.Head>
                {onToggleTagFilter && workspaceTags.length > 0 ? (
                  <HeaderFilterButton label={t("name")} active={(tagFilterIds?.size ?? 0) > 0}>
                    <DropdownMenu.Label>{t("filterByTag")}</DropdownMenu.Label>
                    {workspaceTags.map((tag) => (
                      <DropdownMenu.CheckboxItem
                        key={tag.id}
                        checked={tagFilterIds?.has(tag.id) ?? false}
                        onCheckedChange={() => onToggleTagFilter(tag.id)}
                      >
                        <Badge variant={tag.color as BadgeVariant}>{tag.name}</Badge>
                      </DropdownMenu.CheckboxItem>
                    ))}
                    {(tagFilterIds?.size ?? 0) > 0 && (
                      <>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item icon={XCircleIcon} onClick={onClearTagFilter}>
                          {t("clearFilter")}
                        </DropdownMenu.Item>
                      </>
                    )}
                  </HeaderFilterButton>
                ) : (
                  t("name")
                )}
              </Table.Head>
              <Table.Head>
                {onTypeFilterChange ? (
                  <HeaderFilterButton label={t("type")} active={typeFilter !== "all"}>
                    <DropdownMenu.RadioGroup
                      value={typeFilter}
                      onValueChange={(value) => onTypeFilterChange(value as TypeFilterValue)}
                    >
                      <DropdownMenu.RadioItem value="all">{t("all")}</DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem value="folder">{t("folders")}</DropdownMenu.RadioItem>
                      <DropdownMenu.RadioItem value="file">{t("files")}</DropdownMenu.RadioItem>
                    </DropdownMenu.RadioGroup>
                  </HeaderFilterButton>
                ) : (
                  t("type")
                )}
              </Table.Head>
              <Table.Head>{t("owner")}</Table.Head>
              <Table.Head>{t("modified")}</Table.Head>
              <Table.Head className="text-right">{t("size")}</Table.Head>
              <Table.Head></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => {
              const isFolder = item.type === "folder";
              const isDragOver = dragOverFolderId === item.id;

              return (
                <Table.Row
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragOver={
                    isFolder
                      ? (e) => {
                          e.preventDefault();
                          setDragOverFolderId(item.id);
                        }
                      : undefined
                  }
                  onDragLeave={isFolder ? () => setDragOverFolderId(null) : undefined}
                  onDrop={isFolder ? (e) => handleDropOnFolder(e, item.id) : undefined}
                  variant={selectedItemId === item.id ? "selected" : "default"}
                  className={isDragOver ? "bg-kumo-tint border-2 border-dashed border-kumo-info" : ""}
                >
                  {showSelection && (
                    <Table.CheckCell
                      checked={selectedIds?.has(item.id) ?? false}
                      onCheckedChange={() => onToggleSelectItem?.(item.id)}
                      aria-label={t("selectItem", { name: item.name })}
                    />
                  )}
                  <Table.Cell>
                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(item);
                        }}
                        aria-label={
                          item.isFavorite
                            ? t("removeFavorite", { name: item.name })
                            : t("addFavorite", { name: item.name })
                        }
                        aria-pressed={item.isFavorite}
                        className="flex items-center justify-center border-0 bg-transparent p-1"
                      >
                        <StarIcon
                          size={16}
                          weight={item.isFavorite ? "fill" : "regular"}
                          className={item.isFavorite ? "text-kumo-info" : "text-kumo-subtle"}
                        />
                      </button>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleActivate(item)}
                        className="flex items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-kumo-default hover:text-kumo-strong hover:underline"
                      >
                        <FilePreviewIcon item={item} />
                        {item.name}
                      </button>
                      <TagBadgeList tags={item.tags} max={3} />
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-kumo-subtle">{getFileTypeLabel(item, tFileType)}</Table.Cell>
                  <Table.Cell>
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={item.ownerId} name={item.owner} />
                      {item.owner}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{new Date(item.updatedAt).toLocaleDateString(locale)}</Table.Cell>
                  <Table.Cell className="text-right">{formatFileSize(item.size)}</Table.Cell>
                  <Table.Cell>
                    <FileRowMenu
                      item={item}
                      onRename={onRenameItem}
                      onShare={onShareItem}
                      onDelete={onDeleteItem}
                      onToggleFavorite={onToggleFavorite}
                      onManageTags={onManageTags}
                      onChangeColor={onChangeColor}
                      onDownloadZip={onDownloadZip}
                      onExtractZip={onExtractZip}
                      onArchive={onArchive}
                      onTransfer={onTransfer}
                    />
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </div>
    </LayerCard>
  );
}
