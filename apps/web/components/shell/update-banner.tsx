"use client";

import { useTranslations } from "next-intl";
import { Banner, useKumoToastManager } from "@cloudflare/kumo";
import { ArrowSquareOutIcon, CopyIcon, InfoIcon, QuestionIcon, XIcon } from "@phosphor-icons/react";
import type { AvailableUpdate } from "@/lib/updates";

export function UpdateBanner({
  update,
  onDismiss,
  onHelp,
}: {
  update: AvailableUpdate;
  onDismiss: () => void;
  onHelp: () => void;
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
    <div className="px-4 pt-4">
      <Banner
        variant="default"
        size="sm"
        icon={<InfoIcon weight="fill" />}
        title={t("title", { latest: update.latest })}
        description={t("description", { current: update.current })}
        action={
          <>
            <Banner.Action icon={QuestionIcon} onClick={onHelp}>
              {t("help")}
            </Banner.Action>
            <Banner.Action
              icon={ArrowSquareOutIcon}
              onClick={() => window.open(update.htmlUrl, "_blank", "noopener,noreferrer")}
            >
              {t("viewRelease")}
            </Banner.Action>
            <Banner.Action variant="secondary" icon={CopyIcon} onClick={copyCommand}>
              {t("copyCommand")}
            </Banner.Action>
            <Banner.Action variant="ghost" icon={XIcon} aria-label={t("dismissAria")} onClick={onDismiss} />
          </>
        }
      />
    </div>
  );
}
