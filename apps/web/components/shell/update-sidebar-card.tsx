"use client";

import { useTranslations } from "next-intl";
import { Button, LayerCard, Text } from "@cloudflare/kumo";
import { ArrowCircleUpIcon, QuestionIcon, XIcon } from "@phosphor-icons/react";
import type { AvailableUpdate } from "@/lib/updates";

export function UpdateSidebarCard({
  update,
  onDismiss,
  onHelp,
}: {
  update: AvailableUpdate;
  onDismiss: () => void;
  onHelp: () => void;
}) {
  const t = useTranslations("updateBanner");

  return (
    <LayerCard className="rounded-t-md rounded-b-none px-2.5 py-1.5 shadow-none">
      <div className="flex items-center gap-1">
        <span className="h-lh flex items-center text-kumo-info">
          <ArrowCircleUpIcon size={14} weight="fill" />
        </span>
        <div className="grid min-w-0 flex-1">
          <Text as="span" size="sm" truncate>
            {t("cardTitle")}
          </Text>
          <Text as="span" size="sm" variant="secondary" truncate>
            {t("cardVersion", { latest: update.latest })}
          </Text>
        </div>
        <Button
          variant="ghost"
          shape="square"
          size="sm"
          icon={QuestionIcon}
          aria-label={t("help")}
          onClick={onHelp}
        />
        <Button
          variant="ghost"
          shape="square"
          size="sm"
          icon={XIcon}
          aria-label={t("dismissAria")}
          onClick={onDismiss}
        />
      </div>
    </LayerCard>
  );
}
