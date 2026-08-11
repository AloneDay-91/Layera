"use client";

import { useRouter } from "next/navigation";
import { Button, DropdownMenu, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  UserCircleIcon,
  UserIcon,
  GearIcon,
  SunIcon,
  MoonIcon,
  DesktopIcon,
  CheckIcon,
  BookOpenIcon,
  CommandIcon,
  SignOutIcon,
  SparkleIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "./theme-provider";

export function AccountSwitcher() {
  const router = useRouter();
  const toasts = useKumoToastManager();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { mode, setMode } = useTheme();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  function notifyNotImplemented(feature: string) {
    toasts.add({
      title: "Bientôt disponible",
      description: `La fonctionnalité "${feature}" arrive très vite.`,
    });
  }

  const userName = session?.user?.name ?? "Développeur";
  const userEmail = session?.user?.email ?? "utilisateur@filecloud.io";
  const activeWorkspaceLabel = activeOrg ? activeOrg.name : "Espace Personnel";

  const themeIcon = mode === "dark" ? MoonIcon : mode === "system" ? DesktopIcon : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button variant="ghost" size="sm" icon={UserCircleIcon}>
          <span className="font-medium">{userName}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {/* Header Utilisateur */}
        <DropdownMenu.Group>
          <div className="flex flex-col gap-0.5 px-3 py-2">
            <Text as="span" bold>{userName}</Text>
            <Text as="span" variant="secondary" truncate>{userEmail}</Text>
            <div className="mt-1 flex items-center gap-1 text-kumo-brand">
              <SparkleIcon size={12} className="shrink-0" />
              <Text as="span" size="sm" DANGEROUS_className="text-kumo-brand">
                {activeWorkspaceLabel}
              </Text>
            </div>
          </div>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Section Compte & Paramètres */}
        <DropdownMenu.Group>
          <DropdownMenu.Label>Compte</DropdownMenu.Label>
          <DropdownMenu.LinkItem href="/dashboard/settings" icon={UserIcon}>
            Mon profil
          </DropdownMenu.LinkItem>
          <DropdownMenu.LinkItem href="/dashboard/settings" icon={GearIcon}>
            Réglages applicatifs
          </DropdownMenu.LinkItem>
          <DropdownMenu.Item
            icon={ShieldCheckIcon}
            onClick={() => notifyNotImplemented("Sécurité & Authentification")}
          >
            Sécurité 2FA
          </DropdownMenu.Item>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Section Préférences (Sous-menu Kumo) */}
        <DropdownMenu.Group>
          <DropdownMenu.Label>Préférences</DropdownMenu.Label>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger icon={themeIcon}>
              Thème & Apparence
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item icon={SunIcon} onClick={() => setMode("light")}>
                <span className="flex-1">Clair</span>
                {mode === "light" && <CheckIcon size={14} className="ml-2 text-kumo-brand" />}
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={MoonIcon} onClick={() => setMode("dark")}>
                <span className="flex-1">Sombre</span>
                {mode === "dark" && <CheckIcon size={14} className="ml-2 text-kumo-brand" />}
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={DesktopIcon} onClick={() => setMode("system")}>
                <span className="flex-1">Système</span>
                {mode === "system" && <CheckIcon size={14} className="ml-2 text-kumo-brand" />}
              </DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Section Aide & Documentation */}
        <DropdownMenu.Group>
          <DropdownMenu.Label>Ressources</DropdownMenu.Label>
          <DropdownMenu.Item
            icon={BookOpenIcon}
            onClick={() => notifyNotImplemented("Documentation")}
          >
            Documentation API
          </DropdownMenu.Item>
          <DropdownMenu.Item
            icon={CommandIcon}
            onClick={() => notifyNotImplemented("Raccourcis Clavier")}
          >
            Raccourcis clavier
            <DropdownMenu.Shortcut>⌘K</DropdownMenu.Shortcut>
          </DropdownMenu.Item>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Action Déconnexion */}
        <DropdownMenu.Item variant="danger" icon={SignOutIcon} onClick={handleSignOut}>
          Se déconnecter
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
