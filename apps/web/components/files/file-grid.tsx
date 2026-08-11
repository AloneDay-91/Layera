"use client";

import { Grid, GridItem, LayerCard } from "@cloudflare/kumo";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon } from "./file-preview";

export function FileGrid({
  items,
  selectedItemId,
  onOpenFolder,
  onSelectItem,
}: {
  items: MockItem[];
  selectedItemId: string | null;
  onOpenFolder: (folderId: string) => void;
  onSelectItem: (itemId: string | null) => void;
}) {
  function handleActivate(item: MockItem) {
    if (item.type === "folder") {
      onOpenFolder(item.id);
    } else {
      onSelectItem(selectedItemId === item.id ? null : item.id);
    }
  }

  return (
    <Grid variant="4up" gap="sm">
      {items.map((item) => (
        <GridItem key={item.id}>
          <LayerCard
            render={<button type="button" />}
            onClick={() => handleActivate(item)}
            className={
              selectedItemId === item.id
                ? "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-blue-500 p-4"
                : "flex w-full flex-col items-center gap-2 rounded-lg border border-transparent p-4 hover:border-gray-200"
            }
          >
            <FilePreviewIcon item={item} size={32} />
            <span className="w-full truncate text-center text-sm">{item.name}</span>
            <span className="text-xs text-gray-500">{formatFileSize(item.size)}</span>
          </LayerCard>
        </GridItem>
      ))}
    </Grid>
  );
}
