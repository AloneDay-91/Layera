"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  TagIcon,
} from "@phosphor-icons/react";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function DashboardSidebar() {
  const pathname = usePathname();
  const t = useTranslations("sidebar");

  // Liens de partage et Corbeille sont branchés sur de vraies données ;
  // le reste de "à venir" ne l'est pas encore (composant ComingSoon ou données statiques).
  const ORGANIZER_SUB_ITEMS = [
    { href: "/dashboard/links", label: t("shareLinks") },
    { href: "/dashboard/trash", label: t("trash") },
  ];

  const COMING_SOON_ITEMS = [
    { href: "/dashboard/shared", label: t("sharedWithMe"), icon: ShareIcon },
    { href: "/dashboard/activity", label: t("activity"), icon: ActivityIcon },
    { href: "/dashboard/admin", label: t("admin"), icon: ShieldCheckIcon },
  ];

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
              {t("files")}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton icon={ClockIcon} href="/dashboard/recent" active={pathname === "/dashboard/recent"}>
              {t("recent")}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton icon={StarIcon} href="/dashboard/favorites" active={pathname === "/dashboard/favorites"}>
              {t("favorites")}
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>

        {/* Espace — pages branchées sur de vraies données */}
        <Sidebar.Group>
          <Sidebar.GroupLabel>{t("space")}</Sidebar.GroupLabel>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.Collapsible defaultOpen>
                <Sidebar.CollapsibleTrigger
                  render={
                    <Sidebar.MenuButton icon={FolderIcon}>
                      {t("organize")} <Sidebar.MenuChevron />
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
              icon={TagIcon}
              href="/dashboard/tags"
              active={pathname === "/dashboard/tags"}
            >
              {t("tags")}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton
              icon={HardDriveIcon}
              href="/dashboard/storage"
              active={pathname === "/dashboard/storage"}
            >
              {t("storage")}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton
              icon={GearIcon}
              href="/dashboard/settings"
              active={pathname === "/dashboard/settings"}
            >
              {t("settings")}
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>

        {/* Bientôt disponible — pages pas encore branchées sur de vraies données */}
        <Sidebar.Group>
          <Sidebar.GroupLabel>{t("comingSoon")}</Sidebar.GroupLabel>
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
