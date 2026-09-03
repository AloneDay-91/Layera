"use client";

import { useTranslations } from "next-intl";
import { Empty, LayerCard } from "@cloudflare/kumo";
import type { Icon } from "@phosphor-icons/react";

export function ComingSoon({
  icon: IconComponent,
  title,
  description,
}: {
  icon: Icon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Empty size="sm" icon={<IconComponent size={40} />} title={title} description={description} />
    </div>
  );
}

export function FeatureDisabledState() {
  const t = useTranslations("common");
  return (
    <LayerCard className="p-0">
      <Empty size="sm" title={t("featureDisabledTitle")} description={t("featureDisabledDescription")} />
    </LayerCard>
  );
}
