"use client";

import { DropdownMenu, Button } from "@cloudflare/kumo";
import { DotsThreeIcon, FileZipIcon, PackageIcon, PaintBucketIcon, PencilSimpleIcon, ShareIcon, StarIcon, TagIcon, TrashIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";
import { isZipFile } from "./file-preview";

type FileRowMenuProps = {
  item: MockItem;
  onRename?: (item: MockItem) => void;
  onShare?: (item: MockItem) => void;
  onDelete?: (item: MockItem) => void;
  onToggleFavorite?: (item: MockItem) => void;
  onManageTags?: (item: MockItem) => void;
  onChangeColor?: (item: MockItem) => void;
  onDownloadZip?: (item: MockItem) => void;
  onExtractZip?: (item: MockItem) => void;
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
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button
          variant="ghost"
          shape="square"
          size="sm"
          icon={DotsThreeIcon}
          aria-label={`Actions pour ${item.name}`}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {onToggleFavorite && (
          <DropdownMenu.Item icon={StarIcon} onClick={() => onToggleFavorite(item)}>
            {item.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          </DropdownMenu.Item>
        )}
        {onShare && (
          <DropdownMenu.Item icon={ShareIcon} onClick={() => onShare(item)}>
            Partager
          </DropdownMenu.Item>
        )}
        {onRename && (
          <DropdownMenu.Item icon={PencilSimpleIcon} onClick={() => onRename(item)}>
            Renommer
          </DropdownMenu.Item>
        )}
        {onManageTags && (
          <DropdownMenu.Item icon={TagIcon} onClick={() => onManageTags(item)}>
            Tags
          </DropdownMenu.Item>
        )}
        {item.type === "folder" && onChangeColor && (
          <DropdownMenu.Item icon={PaintBucketIcon} onClick={() => onChangeColor(item)}>
            Changer la couleur
          </DropdownMenu.Item>
        )}
        {item.type === "folder" && onDownloadZip && (
          <DropdownMenu.Item icon={FileZipIcon} onClick={() => onDownloadZip(item)}>
            Télécharger en ZIP
          </DropdownMenu.Item>
        )}
        {isZipFile(item) && onExtractZip && (
          <DropdownMenu.Item icon={PackageIcon} onClick={() => onExtractZip(item)}>
            Extraire
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Separator />
        {onDelete && (
          <DropdownMenu.Item variant="danger" icon={TrashIcon} onClick={() => onDelete(item)}>
            Supprimer
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
