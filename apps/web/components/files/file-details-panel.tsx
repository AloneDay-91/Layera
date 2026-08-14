"use client";

import { useState } from "react";
import { Button, Dialog, Text } from "@cloudflare/kumo";
import { XIcon, ShareIcon, DownloadIcon, StarIcon, TagIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon, getFileTypeLabel, isPreviewable } from "./file-preview";
import { FilePreviewContent } from "./file-preview-content";
import { TagBadgeList } from "./tag-badge-list";

export function FileDetailsPanel({
  item,
  onClose,
  onAction,
  onShare,
  onToggleFavorite,
  onManageTags,
}: {
  item: MockItem;
  onClose: () => void;
  onAction: (action: string) => void;
  onShare?: (item: MockItem) => void;
  onToggleFavorite?: (item: MockItem) => void;
  onManageTags?: (item: MockItem) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewable = isPreviewable(item);

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-kumo-line bg-kumo-base p-4 text-kumo-default">
      <div className="flex items-center justify-between">
        <Text as="h2" bold>
          Détails
        </Text>
        <Button
          variant="secondary"
          shape="square"
          size="sm"
          icon={XIcon}
          aria-label="Fermer le panneau"
          onClick={onClose}
        />
      </div>

      <div className="flex flex-col items-center gap-2 py-4">
        {previewable ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label={`Prévisualiser ${item.name}`}
            className="border-0 bg-transparent p-0"
          >
            <FilePreviewIcon item={item} size={96} />
          </button>
        ) : (
          <FilePreviewIcon item={item} size={48} />
        )}
        <Text as="p" bold DANGEROUS_className="break-all text-center">
          {item.name}
        </Text>
        <TagBadgeList tags={item.tags} />
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <Text as="dt" variant="secondary">Type</Text>
          <dd className="font-medium text-kumo-default">{getFileTypeLabel(item)}</dd>
        </div>
        <div className="flex justify-between">
          <Text as="dt" variant="secondary">Taille</Text>
          <dd className="font-medium text-kumo-default">{formatFileSize(item.size)}</dd>
        </div>
        <div className="flex justify-between">
          <Text as="dt" variant="secondary">Propriétaire</Text>
          <dd className="font-medium text-kumo-default">{item.owner}</dd>
        </div>
        <div className="flex justify-between">
          <Text as="dt" variant="secondary">Modifié</Text>
          <dd className="font-medium text-kumo-default">{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {previewable && (
          <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
            Aperçu
          </Button>
        )}
        {onToggleFavorite && (
          <Button
            variant="secondary"
            size="sm"
            icon={StarIcon}
            onClick={() => onToggleFavorite(item)}
          >
            {item.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon={ShareIcon}
          onClick={() => (onShare ? onShare(item) : onAction("Partager"))}
        >
          Partager
        </Button>
        <Button variant="secondary" size="sm" icon={DownloadIcon} onClick={() => onAction("Télécharger")}>
          Télécharger
        </Button>
        {onManageTags && (
          <Button variant="secondary" size="sm" icon={TagIcon} onClick={() => onManageTags(item)}>
            Tags
          </Button>
        )}
      </div>

      {previewable && (
        <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
          <Dialog size="xl" className="p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <Dialog.Title className="text-lg font-semibold break-all">{item.name}</Dialog.Title>
              <Dialog.Close
                aria-label="Fermer"
                render={(props) => (
                  <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
                )}
              />
            </div>
            <FilePreviewContent item={item} />
          </Dialog>
        </Dialog.Root>
      )}
    </aside>
  );
}
