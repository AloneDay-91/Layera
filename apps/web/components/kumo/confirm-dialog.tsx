"use client";

import { Button, Dialog, Loader, Text } from "@cloudflare/kumo";
import { XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmingLabel?: string;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
  variant?: "destructive" | "primary";
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmingLabel,
  onConfirm,
  isConfirming = false,
  variant = "destructive",
}: ConfirmDialogProps) {
  const t = useTranslations("common");

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (isConfirming) return;
        onOpenChange(nextOpen);
      }}
    >
      <Dialog className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Close
            aria-label={t("close")}
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                shape="square"
                size="sm"
                icon={XIcon}
                aria-label={t("close")}
                disabled={isConfirming}
              />
            )}
          />
        </div>

        <div className="grid gap-6">
          <Text variant="secondary">{description}</Text>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={isConfirming}>
              {t("cancel")}
            </Button>
            <Button
              variant={variant === "primary" ? "primary" : "destructive"}
              size="sm"
              onClick={() => void onConfirm()}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <span className="flex items-center gap-1.5">
                  <Loader size="sm" /> {confirmingLabel ?? confirmLabel}
                </span>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
