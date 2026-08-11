"use client";

import { useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import { FolderSimpleIcon, FilePdfIcon, ImageIcon, FileTextIcon, FileIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";

function getIconForItem(item: MockItem): Icon {
  if (item.type === "folder") return FolderSimpleIcon;
  if (item.mimeType === "application/pdf") return FilePdfIcon;
  if (item.mimeType?.startsWith("image/")) return ImageIcon;
  if (item.mimeType === "text/markdown") return FileTextIcon;
  return FileIcon;
}

function getIconColorForItem(item: MockItem): string {
  if (item.type === "folder") return "text-kumo-warning";
  if (item.mimeType === "application/pdf") return "text-kumo-danger";
  if (item.mimeType?.startsWith("image/")) return "text-kumo-info";
  if (item.mimeType === "text/markdown") return "text-kumo-success";
  return "text-kumo-subtle";
}

export function isPreviewableImage(item: MockItem): boolean {
  return item.type === "file" && (item.mimeType?.startsWith("image/") ?? false);
}

export function FilePreviewIcon({ item, size = 20 }: { item: MockItem; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (isPreviewableImage(item) && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/content?id=${item.id}`}
        alt={item.name}
        width={size}
        height={size}
        onError={() => setImgFailed(true)}
        className="rounded object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  const IconComponent = getIconForItem(item);
  const colorClass = getIconColorForItem(item);
  return <IconComponent size={size} className={colorClass} />;
}
