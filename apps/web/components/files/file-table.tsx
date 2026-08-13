"use client";

import { useState } from "react";
import { LayerCard, Table } from "@cloudflare/kumo";
import { StarIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon } from "./file-preview";
import { FileRowMenu } from "./file-row-menu";

type FileTableProps = {
  items: MockItem[];
  selectedItemId: string | null;
  onOpenFolder: (folderId: string) => void;
  onSelectItem: (itemId: string | null) => void;
  onRenameItem?: (item: MockItem) => void;
  onShareItem?: (item: MockItem) => void;
  onDeleteItem?: (item: MockItem) => void;
  onToggleFavorite?: (item: MockItem) => void;
  onMoveItem?: (draggedItem: { id: string; type: "file" | "folder"; name: string }, targetFolderId: string) => void;
};

export function FileTable({
  items,
  selectedItemId,
  onOpenFolder,
  onSelectItem,
  onRenameItem,
  onShareItem,
  onDeleteItem,
  onToggleFavorite,
  onMoveItem,
}: FileTableProps) {
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
    <LayerCard className="p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head></Table.Head>
            <Table.Head>Nom</Table.Head>
            <Table.Head>Propriétaire</Table.Head>
            <Table.Head>Modifié</Table.Head>
            <Table.Head>Taille</Table.Head>
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
                className={isDragOver ? "bg-kumo-tint border-2 border-dashed border-kumo-brand" : ""}
              >
                <Table.Cell>
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(item);
                      }}
                      aria-label={item.isFavorite ? `Retirer "${item.name}" des favoris` : `Ajouter "${item.name}" aux favoris`}
                      aria-pressed={item.isFavorite}
                      className="flex items-center justify-center border-0 bg-transparent p-1"
                    >
                      <StarIcon
                        size={16}
                        weight={item.isFavorite ? "fill" : "regular"}
                        className={item.isFavorite ? "text-kumo-warning" : "text-kumo-subtle"}
                      />
                    </button>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <button
                    type="button"
                    onClick={() => handleActivate(item)}
                    className="flex items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit] text-kumo-default hover:text-kumo-strong hover:underline"
                  >
                    <FilePreviewIcon item={item} />
                    {item.name}
                  </button>
                </Table.Cell>
                <Table.Cell>{item.owner}</Table.Cell>
                <Table.Cell>{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</Table.Cell>
                <Table.Cell>{formatFileSize(item.size)}</Table.Cell>
                <Table.Cell>
                  <FileRowMenu
                    item={item}
                    onRename={onRenameItem}
                    onShare={onShareItem}
                    onDelete={onDeleteItem}
                    onToggleFavorite={onToggleFavorite}
                  />
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}
