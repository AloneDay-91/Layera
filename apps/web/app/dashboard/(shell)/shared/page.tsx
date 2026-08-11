"use client";

import { Breadcrumbs } from "@cloudflare/kumo";
import { ShareIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/kumo/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SharedPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Partagés avec moi</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Partagés avec moi"
      />
      <ComingSoon
        icon={ShareIcon}
        title="Partage bientôt disponible"
        description="Le partage de fichiers et de dossiers arrive dans une prochaine mise à jour."
      />
    </div>
  );
}
