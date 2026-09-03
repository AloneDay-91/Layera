"use client";

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
import { useNavigation } from "./navigation-provider";
import type { DashboardUser } from "./dashboard-user";
import type { AvailableUpdate } from "@/lib/updates";
import { UpdateSidebarCard } from "./update-sidebar-card";
import { useInstanceFeatures } from "./instance-features";
import { canAccessAdmin } from "@/lib/auth-permissions";

export function DashboardSidebar({
  initialUser,
  availableUpdate,
  onDismissUpdate,
  onUpdateHelp,
}: {
  initialUser: DashboardUser | null;
  availableUpdate: AvailableUpdate | null;
  onDismissUpdate: () => void;
  onUpdateHelp: () => void;
}) {
  const { displayedPath } = useNavigation();
  const t = useTranslations("sidebar");
  const isAdmin = canAccessAdmin(initialUser?.role);
  const { features } = useInstanceFeatures();

  const ORGANIZER_SUB_ITEMS = [
    ...(features.publicSharingEnabled ? [{ href: "/dashboard/links", label: t("shareLinks") }] : []),
    ...(features.archiveEnabled ? [{ href: "/dashboard/archive", label: t("archive") }] : []),
    { href: "/dashboard/trash", label: t("trash") },
  ];

  return (
    <Sidebar className="flex h-full flex-col [&_[data-sidebar=content]]:flex [&_[data-sidebar=content]]:min-h-0 [&_[data-sidebar=content]]:flex-1 [&_[data-sidebar=content]]:flex-col">
      <Sidebar.Header>
        <WorkspaceSwitcher initialUser={initialUser} />
      </Sidebar.Header>

      <Sidebar.Content className="flex min-h-0 flex-1 flex-col pb-0! [&>[role=presentation]]:pb-0! [&_[role=presentation]]:flex [&_[role=presentation]]:h-full [&_[role=presentation]]:min-h-0 [&_[role=presentation]]:flex-col">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {/* Navigation Principale */}
        <Sidebar.Group>
          <Sidebar.Menu>
            <Sidebar.MenuButton icon={HouseIcon} href="/dashboard" active={displayedPath === "/dashboard"}>
              {t("files")}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton icon={ClockIcon} href="/dashboard/recent" active={displayedPath === "/dashboard/recent"}>
              {t("recent")}
            </Sidebar.MenuButton>
            {features.favoritesEnabled ? (
              <Sidebar.MenuButton icon={StarIcon} href="/dashboard/favorites" active={displayedPath === "/dashboard/favorites"}>
                {t("favorites")}
              </Sidebar.MenuButton>
            ) : null}
            <Sidebar.MenuButton icon={ShareIcon} href="/dashboard/shared" active={displayedPath === "/dashboard/shared"}>
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
                        active={displayedPath === item.href}
                      >
                        {item.label}
                      </Sidebar.MenuSubButton>
                    ))}
                  </Sidebar.MenuSub>
                </Sidebar.CollapsibleContent>
              </Sidebar.Collapsible>
            </Sidebar.MenuItem>
            {features.tagsEnabled ? (
              <Sidebar.MenuButton
                icon={TagIcon}
                href="/dashboard/tags"
                active={displayedPath === "/dashboard/tags"}
              >
                {t("tags")}
              </Sidebar.MenuButton>
            ) : null}
            <Sidebar.MenuButton
              icon={HardDriveIcon}
              href="/dashboard/storage"
              active={displayedPath === "/dashboard/storage"}
            >
              {t("storage")}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton
              icon={ActivityIcon}
              href="/dashboard/activity"
              active={displayedPath === "/dashboard/activity"}
            >
              {t("activity")}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton
              icon={GearIcon}
              href="/dashboard/settings"
              active={displayedPath === "/dashboard/settings"}
            >
              {t("settings")}
            </Sidebar.MenuButton>
            {isAdmin ? (
              <Sidebar.MenuButton
                icon={ShieldCheckIcon}
                href="/dashboard/admin"
                active={displayedPath === "/dashboard/admin"}
              >
                {t("admin")}
              </Sidebar.MenuButton>
            ) : null}
          </Sidebar.Menu>
        </Sidebar.Group>
        </div>
        {availableUpdate ? (
          <div className="mt-auto shrink-0">
            <UpdateSidebarCard
              update={availableUpdate}
              onDismiss={onDismissUpdate}
              onHelp={onUpdateHelp}
            />
          </div>
        ) : null}
      </Sidebar.Content>

      <Sidebar.Footer>
        <Sidebar.Trigger />
      </Sidebar.Footer>
    </Sidebar>
  );
}
