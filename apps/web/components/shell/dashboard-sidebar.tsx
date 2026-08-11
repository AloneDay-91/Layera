"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@cloudflare/kumo";
import { HouseIcon, ShareIcon, StarIcon, TrashIcon, GearIcon } from "@phosphor-icons/react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Fichiers", icon: HouseIcon },
  { href: "/dashboard/shared", label: "Partagés", icon: ShareIcon },
  { href: "/dashboard/favorites", label: "Favoris", icon: StarIcon },
  { href: "/dashboard/trash", label: "Corbeille", icon: TrashIcon },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <Sidebar.Header>
        <span className="px-2 text-sm font-semibold">FileCloud</span>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.Menu>
            {NAV_ITEMS.map((item) => (
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
        <Sidebar.Menu>
          <Sidebar.MenuButton
            icon={GearIcon}
            href="/dashboard/settings"
            active={pathname === "/dashboard/settings"}
          >
            Réglages
          </Sidebar.MenuButton>
        </Sidebar.Menu>
      </Sidebar.Footer>
    </Sidebar>
  );
}
