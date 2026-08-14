"use client";

import { useTranslations } from "next-intl";
import { Breadcrumbs } from "@cloudflare/kumo";
import { ActivityIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function ActivityPage() {
  const t = useTranslations("activityPage");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">{tBreadcrumbs("myFiles")}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>{t("title")}</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title={t("title")}
      />
      <ComingSoon
        icon={ActivityIcon}
        title={t("title")}
        description={t("description")}
      />
    </div>
  );
}
