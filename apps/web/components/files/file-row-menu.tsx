"use client";

import { DropdownMenu, Button } from "@cloudflare/kumo";
import { DotsThreeIcon, PencilSimpleIcon, ShareIcon, TrashIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";

type FileRowMenuProps = {
  item: MockItem;
  onRename?: (item: MockItem) => void;
  onShare?: (item: MockItem) => void;
  onDelete?: (item: MockItem) => void;
};

export function FileRowMenu({ item, onRename, onShare, onDelete }: FileRowMenuProps) {
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
