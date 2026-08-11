"use client";

import { Breadcrumbs } from "@cloudflare/kumo";
import { ActivityIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function ActivityPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Journaux d&apos;activité</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Journaux d'activité"
      />
      <ComingSoon
        icon={ActivityIcon}
        title="Journaux d'activité"
        description="Historique des actions, créations, suppressions et partages."
      />
    </div>
  );
}
