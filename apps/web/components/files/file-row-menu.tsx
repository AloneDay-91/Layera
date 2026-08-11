"use client";

import { DropdownMenu, Button, useKumoToastManager } from "@cloudflare/kumo";
import { DotsThreeIcon, PencilSimpleIcon, ArrowsOutCardinalIcon, TrashIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";

export function FileRowMenu({ item }: { item: MockItem }) {
  const toasts = useKumoToastManager();

  function notImplemented(action: string) {
    toasts.add({
      title: "Bientôt disponible",
      description: `"${action}" pour "${item.name}" n'est pas encore implémenté.`,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button
          variant="secondary"
          shape="square"
          icon={DotsThreeIcon}
          aria-label={`Actions pour ${item.name}`}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item icon={PencilSimpleIcon} onClick={() => notImplemented("Renommer")}>
          Renommer
        </DropdownMenu.Item>
        <DropdownMenu.Item icon={ArrowsOutCardinalIcon} onClick={() => notImplemented("Déplacer")}>
          Déplacer
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="danger" icon={TrashIcon} onClick={() => notImplemented("Supprimer")}>
          Supprimer
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
