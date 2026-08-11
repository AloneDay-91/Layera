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

export function FilePreviewIcon({ item, size = 20 }: { item: MockItem; size?: number }) {
  const IconComponent = getIconForItem(item);
  return <IconComponent size={size} />;
}
