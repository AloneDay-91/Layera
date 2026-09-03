"use client";

import { useTranslations } from "next-intl";
import { Button, Dialog, Text, useKumoToastManager } from "@cloudflare/kumo";
import { ArrowSquareOutIcon, CopyIcon, XIcon } from "@phosphor-icons/react";
import type { AvailableUpdate } from "@/lib/updates";

export function UpdateHelpDialog({
  update,
  open,
  onOpenChange,
}: {
  update: AvailableUpdate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("updateBanner");
  const toasts = useKumoToastManager();

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(update.composeCommand);
      toasts.add({ title: t("copiedTitle"), description: t("copiedDescription") });
    } catch {
      toasts.add({ title: t("copyErrorTitle"), description: t("copyErrorDescription") });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Dialog.Title className="text-lg font-semibold">{t("dialogTitle")}</Dialog.Title>
          <Dialog.Close
            aria-label={t("close")}
            render={(props) => (
              <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} />
            )}
          />
        </div>
        <Dialog.Description>
          {t("dialogIntro", { current: update.current, latest: update.latest })}
        </Dialog.Description>
        <ol className="mt-4 grid list-decimal gap-3 pl-5">
          <li>
            <div className="grid gap-0.5">
              <Text as="span" bold>
                {t("step1Title")}
              </Text>
              <Text variant="secondary">{t("step1")}</Text>
            </div>
          </li>
          <li>
            <div className="grid gap-1.5">
              <Text as="span" bold>
                {t("step2Title")}
              </Text>
              <Text variant="secondary">{t("step2")}</Text>
              <code className="block overflow-x-auto rounded-lg bg-kumo-tint px-3 py-2 font-mono text-[0.9em] text-kumo-default">
                {update.composeCommand}
              </code>
            </div>
          </li>
          <li>
            <div className="grid gap-0.5">
              <Text as="span" bold>
                {t("step3Title")}
              </Text>
              <Text variant="secondary">{t("step3")}</Text>
            </div>
          </li>
        </ol>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowSquareOutIcon}
            onClick={() => window.open(update.htmlUrl, "_blank", "noopener,noreferrer")}
          >
            {t("viewRelease")}
          </Button>
          <Button variant="primary" size="sm" icon={CopyIcon} onClick={copyCommand}>
            {t("copyCommand")}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
