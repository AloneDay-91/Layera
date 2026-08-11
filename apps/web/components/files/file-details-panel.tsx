"use client";

import { Button } from "@cloudflare/kumo";
import { XIcon, ShareIcon, DownloadIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon } from "./file-preview";

export function FileDetailsPanel({
  item,
  onClose,
  onAction,
}: {
  item: MockItem;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <aside className="flex w-72 flex-shrink-0 flex-col gap-4 border-l border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Détails</h2>
        <Button
          variant="secondary"
          shape="square"
          icon={XIcon}
          aria-label="Fermer le panneau"
          onClick={onClose}
        />
      </div>

      <div className="flex flex-col items-center gap-2 py-4">
        <FilePreviewIcon item={item} size={48} />
        <p className="break-all text-center text-sm font-medium">{item.name}</p>
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Type</dt>
          <dd>{item.type === "folder" ? "Dossier" : item.mimeType ?? "Fichier"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Taille</dt>
          <dd>{formatFileSize(item.size)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Propriétaire</dt>
          <dd>{item.owner}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Modifié</dt>
          <dd>{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</dd>
        </div>
      </dl>

      <div className="flex gap-2">
        <Button variant="secondary" icon={ShareIcon} onClick={() => onAction("Partager")}>
          Partager
        </Button>
        <Button variant="secondary" icon={DownloadIcon} onClick={() => onAction("Télécharger")}>
          Télécharger
        </Button>
      </div>
    </aside>
  );
}
