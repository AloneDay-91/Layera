"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Breadcrumbs, Grid, GridItem, LayerCard, Meter, Text } from "@cloudflare/kumo";
import {
  HardDriveIcon,
  FileIcon,
  FolderIcon,
  TrashIcon,
  ImageIcon,
  FileTextIcon,
  FilmStripIcon,
  DotsThreeCircleIcon,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { DashboardPageSkeleton } from "@/components/shell/dashboard-page-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { formatFileSize } from "@/lib/file-item";

type StorageStats = {
  usedBytes: number;
  quotaBytes: number;
  fileCount: number;
  folderCount: number;
  trashBytes: number;
  trashCount: number;
  categories: { images: number; documents: number; videos: number; other: number };
};

const CATEGORY_META = [
  { key: "images" as const, labelKey: "categoryImages" as const, icon: ImageIcon },
  { key: "documents" as const, labelKey: "categoryDocuments" as const, icon: FileTextIcon },
  { key: "videos" as const, labelKey: "categoryVideos" as const, icon: FilmStripIcon },
  { key: "other" as const, labelKey: "categoryOther" as const, icon: DotsThreeCircleIcon },
];

export default function StoragePage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);
  const t = useTranslations("storagePage");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const res = await fetch("/api/storage/stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (err) {
        console.error("Erreur chargement des statistiques de stockage :", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [activeOrg?.id]);

  const usedPercent = stats && stats.quotaBytes > 0 ? Math.min(100, (stats.usedBytes / stats.quotaBytes) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">{tBreadcrumbs("myFiles")}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>{t("title")}</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title={t("title")}
        description={t("description")}
      />

      <div className="flex flex-1 flex-col gap-6 pt-6">
        {loading || !stats ? (
          <DashboardPageSkeleton path="/dashboard/storage" contentOnly />
        ) : (
          <>
            <Grid variant="4up" gap="base">
              <GridItem>
                <LayerCard>
                  <LayerCard.Secondary className="flex items-center justify-between">
                    <Text as="span" variant="secondary">{t("files")}</Text>
                    <FileIcon size={16} className="text-kumo-info" />
                  </LayerCard.Secondary>
                  <LayerCard.Primary>
                    <Text as="p" variant="heading2">{stats.fileCount}</Text>
                  </LayerCard.Primary>
                </LayerCard>
              </GridItem>
              <GridItem>
                <LayerCard>
                  <LayerCard.Secondary className="flex items-center justify-between">
                    <Text as="span" variant="secondary">{t("folders")}</Text>
                    <FolderIcon size={16} className="text-kumo-info" />
                  </LayerCard.Secondary>
                  <LayerCard.Primary>
                    <Text as="p" variant="heading2">{stats.folderCount}</Text>
                  </LayerCard.Primary>
                </LayerCard>
              </GridItem>
              <GridItem>
                <LayerCard>
                  <LayerCard.Secondary className="flex items-center justify-between">
                    <Text as="span" variant="secondary">{t("totalSpace")}</Text>
                    <HardDriveIcon size={16} className="text-kumo-info" />
                  </LayerCard.Secondary>
                  <LayerCard.Primary className="grid gap-1.5">
                    <Text as="p" variant="heading2">{formatFileSize(stats.usedBytes)}</Text>
                    <Text variant="secondary">{formatFileSize(stats.quotaBytes)}</Text>
                  </LayerCard.Primary>
                </LayerCard>
              </GridItem>
              <GridItem>
                <LayerCard>
                  <LayerCard.Secondary className="flex items-center justify-between">
                    <Text as="span" variant="secondary">{t("trash")}</Text>
                    <TrashIcon size={16} className="text-kumo-danger" />
                  </LayerCard.Secondary>
                  <LayerCard.Primary className="grid gap-1.5">
                    <Text as="p" variant="heading2">{formatFileSize(stats.trashBytes)}</Text>
                    <Text variant="secondary">{t("itemCount", { count: stats.trashCount })}</Text>
                  </LayerCard.Primary>
                </LayerCard>
              </GridItem>
            </Grid>

            <LayerCard className="flex flex-col gap-6 px-5 py-4">
              <Meter
                label={t("usedStorage")}
                value={usedPercent}
                customValue={`${formatFileSize(stats.usedBytes)} / ${formatFileSize(stats.quotaBytes)}`}
              />
              <div className="flex flex-col gap-4">
                {CATEGORY_META.map(({ key, labelKey, icon: Icon }) => {
                  const bytes = stats.categories[key];
                  const percent = stats.quotaBytes > 0 ? (bytes / stats.quotaBytes) * 100 : 0;
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <span className="h-lh flex items-center">
                        <Icon size={16} className="text-kumo-subtle" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Meter label={t(labelKey)} value={percent} customValue={formatFileSize(bytes)} showValue />
                      </div>
                    </div>
                  );
                })}
              </div>
            </LayerCard>
          </>
        )}
      </div>
    </div>
  );
}
