"use client";

import { ShareIcon } from "@phosphor-icons/react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SharedPage() {
  return (
    <ComingSoon
      icon={ShareIcon}
      title="Partage bientôt disponible"
      description="Le partage de fichiers et de dossiers arrive dans une prochaine mise à jour."
    />
  );
}
