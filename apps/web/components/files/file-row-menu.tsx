"use client";

import { useTranslations } from "next-intl";
import { DropdownMenu, Button } from "@cloudflare/kumo";
import { DotsThreeIcon, FileZipIcon, PackageIcon, PaintBucketIcon, PencilSimpleIcon, ShareIcon, StarIcon, TagIcon, TrashIcon } from "@phosphor-icons/react";
import type { FileItem } from "@/lib/file-item";
import { isZipFile } from "./file-preview";

type FileRowMenuProps = {
  item: FileItem;
  onRename?: (item: FileItem) => void;
  onShare?: (item: FileItem) => void;
  onDelete?: (item: FileItem) => void;
  onToggleFavorite?: (item: FileItem) => void;
  onManageTags?: (item: FileItem) => void;
  onChangeColor?: (item: FileItem) => void;
  onDownloadZip?: (item: FileItem) => void;
  onExtractZip?: (item: FileItem) => void;
};

export function FileRowMenu({
  item,
  onRename,
  onShare,
  onDelete,
  onToggleFavorite,
  onManageTags,
  onChangeColor,
  onDownloadZip,
  onExtractZip,
}: FileRowMenuProps) {
  const t = useTranslations("fileRowMenu");
  const tTable = useTranslations("fileTable");

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button
          variant="ghost"
          shape="square"
          size="sm"
          icon={DotsThreeIcon}
          aria-label={tTable("actionsFor", { name: item.name })}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {onToggleFavorite && (
          <DropdownMenu.Item icon={StarIcon} onClick={() => onToggleFavorite(item)}>
            {item.isFavorite ? t("removeFavorite") : t("addFavorite")}
          </DropdownMenu.Item>
        )}
        {onShare && (
          <DropdownMenu.Item icon={ShareIcon} onClick={() => onShare(item)}>
            {t("share")}
          </DropdownMenu.Item>
        )}
        {onRename && (
          <DropdownMenu.Item icon={PencilSimpleIcon} onClick={() => onRename(item)}>
            {t("rename")}
          </DropdownMenu.Item>
        )}
        {onManageTags && (
          <DropdownMenu.Item icon={TagIcon} onClick={() => onManageTags(item)}>
            {t("tags")}
          </DropdownMenu.Item>
        )}
        {item.type === "folder" && onChangeColor && (
          <DropdownMenu.Item icon={PaintBucketIcon} onClick={() => onChangeColor(item)}>
            {t("changeColor")}
          </DropdownMenu.Item>
        )}
        {item.type === "folder" && onDownloadZip && (
          <DropdownMenu.Item icon={FileZipIcon} onClick={() => onDownloadZip(item)}>
            {t("downloadZip")}
          </DropdownMenu.Item>
        )}
        {isZipFile(item) && onExtractZip && (
          <DropdownMenu.Item icon={PackageIcon} onClick={() => onExtractZip(item)}>
            {t("extract")}
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Separator />
        {onDelete && (
          <DropdownMenu.Item variant="danger" icon={TrashIcon} onClick={() => onDelete(item)}>
            {t("delete")}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
