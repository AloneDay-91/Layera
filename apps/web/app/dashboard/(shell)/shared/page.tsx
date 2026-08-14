"use client";

import { useTranslations } from "next-intl";
import { Breadcrumbs } from "@cloudflare/kumo";
import { ShareIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SharedPage() {
  const t = useTranslations("sharedPage");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">{tBreadcrumbs("myFiles")}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>{t("breadcrumb")}</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title={t("breadcrumb")}
      />
      <ComingSoon
        icon={ShareIcon}
        title={t("comingSoonTitle")}
        description={t("comingSoonDescription")}
      />
    </div>
  );
}
