"use client";

import { useState } from "react";
import { Grid, GridItem, LayerCard, Text } from "@cloudflare/kumo";
import { StarIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon } from "./file-preview";

type FileGridProps = {
  items: MockItem[];
  selectedItemId: string | null;
  onOpenFolder: (folderId: string) => void;
  onSelectItem: (itemId: string | null) => void;
  onToggleFavorite?: (item: MockItem) => void;
  onMoveItem?: (draggedItem: { id: string; type: "file" | "folder"; name: string }, targetFolderId: string) => void;
};

export function FileGrid({
  items,
  selectedItemId,
  onOpenFolder,
  onSelectItem,
  onToggleFavorite,
  onMoveItem,
}: FileGridProps) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  function handleActivate(item: MockItem) {
    if (item.type === "folder") {
      onOpenFolder(item.id);
    } else {
      onSelectItem(selectedItemId === item.id ? null : item.id);
    }
  }

  function handleDragStart(e: React.DragEvent, item: MockItem) {
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
    <Grid variant="4up" gap="sm">
      {items.map((item) => {
        const isFolder = item.type === "folder";
        const isDragOver = dragOverFolderId === item.id;

        return (
          <GridItem key={item.id}>
            <div
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
              className="relative w-full"
            >
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item);
                  }}
                  aria-label={item.isFavorite ? `Retirer "${item.name}" des favoris` : `Ajouter "${item.name}" aux favoris`}
                  aria-pressed={item.isFavorite}
                  className="absolute right-2 top-2 z-10 border-0 bg-transparent p-1"
                >
                  <StarIcon
                    size={16}
                    weight={item.isFavorite ? "fill" : "regular"}
                    className={item.isFavorite ? "text-kumo-warning" : "text-kumo-subtle"}
                  />
                </button>
              )}
              <LayerCard
                render={<button type="button" />}
                onClick={() => handleActivate(item)}
                className={
                  isDragOver
                    ? "flex w-full flex-col items-center gap-2 rounded-lg p-4 bg-kumo-tint border-2 border-dashed border-kumo-brand"
                    : selectedItemId === item.id
                      ? "flex w-full flex-col items-center gap-2 rounded-lg p-4 ring-2 ring-kumo-brand"
                      : "flex w-full flex-col items-center gap-2 rounded-lg p-4 hover:bg-kumo-tint"
                }
              >
                <FilePreviewIcon item={item} size={32} />
                <Text as="span" truncate DANGEROUS_className="w-full text-center">{item.name}</Text>
                <Text as="span" variant="secondary">{formatFileSize(item.size)}</Text>
              </LayerCard>
            </div>
          </GridItem>
        );
      })}
    </Grid>
  );
}
