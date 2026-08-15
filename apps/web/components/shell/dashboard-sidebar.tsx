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
  ArchiveIcon,
} from "@phosphor-icons/react";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { authClient } from "@/lib/auth-client";

export function DashboardSidebar() {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";

  const ORGANIZER_SUB_ITEMS = [
    { href: "/dashboard/links", label: t("shareLinks") },
    { href: "/dashboard/archive", label: t("archive") },
    { href: "/dashboard/trash", label: t("trash") },
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
            <Sidebar.MenuButton icon={ShareIcon} href="/dashboard/shared" active={pathname === "/dashboard/shared"}>
              {t("sharedWithMe")}
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
              icon={ActivityIcon}
              href="/dashboard/activity"
              active={pathname === "/dashboard/activity"}
            >
              {t("activity")}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton
              icon={GearIcon}
              href="/dashboard/settings"
              active={pathname === "/dashboard/settings"}
            >
              {t("settings")}
            </Sidebar.MenuButton>
            {isAdmin ? (
              <Sidebar.MenuButton
                icon={ShieldCheckIcon}
                href="/dashboard/admin"
                active={pathname === "/dashboard/admin"}
              >
                {t("admin")}
              </Sidebar.MenuButton>
            ) : null}
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>

      <Sidebar.Footer>
        <Sidebar.Trigger />
      </Sidebar.Footer>
    </Sidebar>
  );
}
