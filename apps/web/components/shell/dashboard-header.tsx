"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Meter, Sidebar, Text } from "@cloudflare/kumo";
import { AccountSwitcher } from "./account-switcher";
import { authClient } from "@/lib/auth-client";
import { formatFileSize } from "@/lib/mock-files";
import { onStorageUpdated } from "@/lib/storage-events";

type StorageSummary = { usedBytes: number; quotaBytes: number };

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Mes fichiers",
  "/dashboard/recent": "Récents",
  "/dashboard/shared": "Partagés avec moi",
  "/dashboard/favorites": "Favoris",
  "/dashboard/links": "Liens de partage",
  "/dashboard/trash": "Corbeille",
  "/dashboard/tags": "Tags",
  "/dashboard/storage": "Analyse du stockage",
  "/dashboard/activity": "Journaux d'activité",
  "/dashboard/admin": "Administration",
  "/dashboard/settings": "Réglages",
};

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const { data: activeOrg } = authClient.useActiveOrganization();

  useEffect(() => {
    function fetchStorage() {
      fetch("/api/storage/stats")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setStorage({ usedBytes: data.usedBytes, quotaBytes: data.quotaBytes }))
        .catch(() => {});
    }
    fetchStorage();
    return onStorageUpdated(fetchStorage);
  }, [activeOrg?.id]);

  const pageLabel = PAGE_LABELS[pathname] ?? "Layera";
  const usedPercent = storage && storage.quotaBytes > 0 ? Math.min(100, (storage.usedBytes / storage.quotaBytes) * 100) : 0;

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val.trim()) {
      params.set("search", val.trim());
    } else {
      params.delete("search");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <header
      suppressHydrationWarning
      className="flex h-14.5 shrink-0 items-center justify-between gap-4 border-b border-kumo-line px-4"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Sidebar.Trigger className="md:hidden" />
        <Text as="h1" variant="heading3" DANGEROUS_className="truncate">
          {pageLabel}
        </Text>
      </div>

      <Input
        size="sm"
        placeholder="Rechercher des fichiers…"
        value={searchQuery}
        onChange={handleSearchChange}
        aria-label="Rechercher des fichiers"
        className="min-w-0 flex-1 basis-40 sm:max-w-xs"
      />

      <div className="flex items-center gap-4">
        {storage && (
          <Link
            href="/dashboard/storage"
            className="hidden w-36 shrink-0 md:block **:text-xs!"
          >
            <Meter label="Stockage" value={usedPercent} customValue={formatFileSize(storage.usedBytes)} />
          </Link>
        )}
        <AccountSwitcher />
      </div>
    </header>
  );
}
