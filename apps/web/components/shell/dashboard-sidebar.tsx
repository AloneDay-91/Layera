"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@cloudflare/kumo";
import {
  HouseIcon,
  ClockIcon,
  FolderIcon,
  GearIcon,
  HardDriveIcon,
  ActivityIcon,
  ShieldCheckIcon,
  ShareIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { WorkspaceSwitcher } from "./workspace-switcher";

// Liens de partage et Corbeille sont branchés sur de vraies données ;
// le reste de "à venir" ne l'est pas encore (composant ComingSoon ou données statiques).
const ORGANIZER_SUB_ITEMS = [
  { href: "/dashboard/links", label: "Liens de partage" },
  { href: "/dashboard/trash", label: "Corbeille" },
];

const COMING_SOON_ITEMS = [
  { href: "/dashboard/shared", label: "Partagés avec moi", icon: ShareIcon },
  { href: "/dashboard/activity", label: "Activité", icon: ActivityIcon },
  { href: "/dashboard/admin", label: "Administration", icon: ShieldCheckIcon },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="h-full flex flex-col">
      <Sidebar.Header>
        <WorkspaceSwitcher />
      </Sidebar.Header>

      <Sidebar.Content className="flex-1 space-y-2">
        {/* Navigation Principale */}
        <Sidebar.Group>
          <Sidebar.Menu>
            <Sidebar.MenuButton icon={HouseIcon} href="/dashboard" active={pathname === "/dashboard"}>
              Fichiers
            </Sidebar.MenuButton>
            <Sidebar.MenuButton icon={ClockIcon} href="/dashboard/recent" active={pathname === "/dashboard/recent"}>
              Récents
            </Sidebar.MenuButton>
            <Sidebar.MenuButton icon={StarIcon} href="/dashboard/favorites" active={pathname === "/dashboard/favorites"}>
              Favoris
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>

        {/* Espace — pages branchées sur de vraies données */}
        <Sidebar.Group>
          <Sidebar.GroupLabel>Espace</Sidebar.GroupLabel>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.Collapsible defaultOpen>
                <Sidebar.CollapsibleTrigger
                  render={
                    <Sidebar.MenuButton icon={FolderIcon}>
                      Organiser <Sidebar.MenuChevron />
                    </Sidebar.MenuButton>
                  }
                />
                <Sidebar.CollapsibleContent>
                  <Sidebar.MenuSub>
                    {ORGANIZER_SUB_ITEMS.map((item) => (
                      <Sidebar.MenuSubButton
                        key={item.href}
                        href={item.href}
                        active={pathname === item.href}
                      >
                        {item.label}
                      </Sidebar.MenuSubButton>
                    ))}
                  </Sidebar.MenuSub>
                </Sidebar.CollapsibleContent>
              </Sidebar.Collapsible>
            </Sidebar.MenuItem>
            <Sidebar.MenuButton
              icon={HardDriveIcon}
              href="/dashboard/storage"
              active={pathname === "/dashboard/storage"}
            >
              Stockage
            </Sidebar.MenuButton>
            <Sidebar.MenuButton
              icon={GearIcon}
              href="/dashboard/settings"
              active={pathname === "/dashboard/settings"}
            >
              Réglages
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>

        {/* Bientôt disponible — pages pas encore branchées sur de vraies données */}
        <Sidebar.Group>
          <Sidebar.GroupLabel>Bientôt disponible</Sidebar.GroupLabel>
          <Sidebar.Menu>
            {COMING_SOON_ITEMS.map((item) => (
              <Sidebar.MenuButton
                key={item.href}
                icon={item.icon}
                href={item.href}
                active={pathname === item.href}
              >
                {item.label}
              </Sidebar.MenuButton>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>

      <Sidebar.Footer>
        <Sidebar.Trigger />
      </Sidebar.Footer>
    </Sidebar>
  );
}
