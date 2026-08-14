"use client";

import { Button, Dialog, Text, cn } from "@cloudflare/kumo";
import { CheckIcon, FolderSimpleIcon, XIcon } from "@phosphor-icons/react";
import type { MockItem } from "@/lib/mock-files";
import { FOLDER_COLOR_OPTIONS, type FolderColorValue } from "@/lib/folder-colors";

type FolderColorDialogProps = {
  item: MockItem | null;
  onClose: () => void;
  onSelectColor: (item: MockItem, color: FolderColorValue) => void;
};

export function FolderColorDialog({ item, onClose, onSelectColor }: FolderColorDialogProps) {
  const currentColor = item?.color ?? "default";

  return (
    <Dialog.Root open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Dialog.Title className="text-lg font-semibold">
            Couleur de &quot;{item?.name}&quot;
          </Dialog.Title>
          <Dialog.Close
            aria-label="Fermer"
            render={(props) => (
              <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
            )}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FOLDER_COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => item && onSelectColor(item, opt.value)}
              aria-label={opt.label}
              aria-pressed={currentColor === opt.value}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border-0 bg-transparent p-2 hover:bg-kumo-tint",
                currentColor === opt.value && "ring-2 ring-kumo-info",
              )}
            >
              <span className="relative">
                <FolderSimpleIcon size={28} weight="fill" className={opt.textClass} />
                {currentColor === opt.value && (
                  <CheckIcon
                    size={12}
                    weight="bold"
                    className="absolute -right-1 -bottom-1 rounded-full bg-kumo-base text-kumo-info"
                  />
                )}
              </span>
              <Text as="span" size="sm">{opt.label}</Text>
            </button>
          ))}
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
