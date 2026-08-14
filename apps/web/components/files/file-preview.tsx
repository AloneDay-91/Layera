"use client";

import { useState } from "react";
import { cn } from "@cloudflare/kumo";
import type { Icon } from "@phosphor-icons/react";
import {
  FolderSimpleIcon,
  FilePdfIcon,
  FileVideoIcon,
  FileAudioIcon,
  FileCodeIcon,
  ImageIcon,
  FileTextIcon,
  FileIcon,
} from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";
import { getLangFromFilename } from "@/lib/code-lang";

const CODE_EXTENSIONS = new Set([
  "js", "mjs", "cjs", "ts", "mts", "cts", "jsx", "tsx", "json", "jsonc", "html", "htm",
  "css", "py", "yaml", "yml", "graphql", "gql", "sql", "sh", "bash", "zsh", "diff", "patch",
  "hcl", "tf", "toml", "txt", "log", "csv",
]);

function hasCodeExtension(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return CODE_EXTENSIONS.has(ext);
}

export function isPreviewableImage(item: MockItem): boolean {
  return item.type === "file" && (item.mimeType?.startsWith("image/") ?? false);
}

export function isPreviewablePdf(item: MockItem): boolean {
  return item.type === "file" && item.mimeType === "application/pdf";
}

export function isPreviewableVideo(item: MockItem): boolean {
  return item.type === "file" && (item.mimeType?.startsWith("video/") ?? false);
}

export function isPreviewableAudio(item: MockItem): boolean {
  return item.type === "file" && (item.mimeType?.startsWith("audio/") ?? false);
}

export function isPreviewableText(item: MockItem): boolean {
  if (item.type !== "file") return false;
  if (item.mimeType?.startsWith("text/")) return true;
  if (item.mimeType === "application/json") return true;
  return hasCodeExtension(item.name);
}

export function isPreviewableMarkdown(item: MockItem): boolean {
  return item.type === "file" && (item.mimeType === "text/markdown" || item.name.toLowerCase().endsWith(".md"));
}

export function isPreviewable(item: MockItem): boolean {
  return (
    isPreviewableImage(item) ||
    isPreviewablePdf(item) ||
    isPreviewableVideo(item) ||
    isPreviewableAudio(item) ||
    isPreviewableText(item)
  );
}

function getIconForItem(item: MockItem): Icon {
  if (item.type === "folder") return FolderSimpleIcon;
  if (isPreviewablePdf(item)) return FilePdfIcon;
  if (isPreviewableImage(item)) return ImageIcon;
  if (isPreviewableVideo(item)) return FileVideoIcon;
  if (isPreviewableAudio(item)) return FileAudioIcon;
  if (isPreviewableMarkdown(item)) return FileTextIcon;
  if (isPreviewableText(item)) return FileCodeIcon;
  return FileIcon;
}

export function getFileTypeLabel(item: MockItem): string {
  if (item.type === "folder") return "Dossier";
  if (!item.mimeType) return "Fichier";

  const subtype = item.mimeType.split("/")[1]?.toUpperCase();

  if (isPreviewablePdf(item)) return "PDF";
  if (isPreviewableImage(item)) return subtype ? `Image ${subtype}` : "Image";
  if (isPreviewableVideo(item)) return subtype ? `Vidéo ${subtype}` : "Vidéo";
  if (isPreviewableAudio(item)) return subtype ? `Audio ${subtype}` : "Audio";
  if (isPreviewableMarkdown(item)) return "Markdown";
  if (isPreviewableText(item)) return "Texte";

  const ext = item.name.split(".").pop();
  return ext && ext !== item.name ? `Fichier ${ext.toUpperCase()}` : "Fichier";
}

function getIconColorForItem(item: MockItem): string {
  if (item.type === "folder") return "text-kumo-info";
  if (isPreviewablePdf(item)) return "text-kumo-danger";
  if (isPreviewableImage(item)) return "text-kumo-info";
  if (isPreviewableMarkdown(item)) return "text-kumo-success";
  return "text-kumo-subtle";
}

export function FilePreviewIcon({ item, size = 20 }: { item: MockItem; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (isPreviewableImage(item) && !imgFailed) {
    return (
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {!imgLoaded && (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-pulse rounded bg-kumo-tint"
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/content?id=${item.id}`}
          alt={item.name}
          width={size}
          height={size}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          className={cn("rounded object-cover shrink-0", !imgLoaded && "opacity-0")}
          style={{ width: size, height: size }}
        />
      </span>
    );
  }

  const IconComponent = getIconForItem(item);
  const colorClass = getIconColorForItem(item);
  return <IconComponent size={size} className={colorClass} />;
}

export { getLangFromFilename };
