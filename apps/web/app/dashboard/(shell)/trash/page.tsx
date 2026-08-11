"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function TrashPage() {
  return (
    <ComingSoon
      icon={TrashIcon}
      title="Corbeille bientôt disponible"
      description="Les éléments supprimés apparaîtront ici, avec possibilité de restauration."
    />
  );
}
