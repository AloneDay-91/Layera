"use client";

import { StarIcon } from "@phosphor-icons/react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function FavoritesPage() {
  return (
    <ComingSoon
      icon={StarIcon}
      title="Favoris bientôt disponibles"
      description="Vous pourrez bientôt marquer des fichiers et dossiers comme favoris."
    />
  );
}
