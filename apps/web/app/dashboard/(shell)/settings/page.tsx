"use client";

import { GearIcon } from "@phosphor-icons/react";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={GearIcon}
      title="Réglages bientôt disponibles"
      description="La gestion du profil et des préférences arrive dans une prochaine mise à jour."
    />
  );
}
