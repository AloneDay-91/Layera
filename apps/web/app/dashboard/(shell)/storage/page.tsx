"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs, Grid, GridItem, LayerCard, Meter, SkeletonLine, Text } from "@cloudflare/kumo";
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
import { ClientOnly } from "@/components/shell/client-only";
import { formatFileSize } from "@/lib/mock-files";

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
  { key: "images" as const, label: "Images", icon: ImageIcon },
  { key: "documents" as const, label: "Documents", icon: FileTextIcon },
  { key: "videos" as const, label: "Vidéos", icon: FilmStripIcon },
  { key: "other" as const, label: "Autres", icon: DotsThreeCircleIcon },
];

export default function StoragePage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

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
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Analyse du stockage</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Analyse du stockage"
        description="Visualisez l'occupation de votre espace de stockage S3/MinIO."
      />

      <div className="flex flex-1 flex-col gap-6 pt-6 max-w-3xl">
        {loading || !stats ? (
          <ClientOnly fallback={<div className="min-h-40 animate-pulse rounded-lg border border-kumo-line bg-kumo-base" />}>
            <div className="flex flex-col gap-3 rounded-lg border border-kumo-line bg-kumo-base p-4">
              <SkeletonLine minWidth={40} maxWidth={40} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
              <SkeletonLine minWidth={100} maxWidth={100} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-3" />
            </div>
          </ClientOnly>
        ) : (
          <>
            <LayerCard className="flex flex-col gap-4 p-5">
              <Meter
                label="Stockage utilisé"
                value={usedPercent}
                customValue={`${formatFileSize(stats.usedBytes)} / ${formatFileSize(stats.quotaBytes)}`}
              />

              <div className="flex flex-col gap-3">
                {CATEGORY_META.map(({ key, label, icon: Icon }) => {
                  const bytes = stats.categories[key];
                  const percent = stats.quotaBytes > 0 ? (bytes / stats.quotaBytes) * 100 : 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <Icon size={18} className="shrink-0 text-kumo-subtle" />
                      <div className="min-w-0 flex-1">
                        <Meter label={label} value={percent} customValue={formatFileSize(bytes)} showValue />
                      </div>
                    </div>
                  );
                })}
              </div>
            </LayerCard>

            <Grid variant="4up" gap="base">
              <GridItem>
                <LayerCard className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between text-kumo-subtle">
                    <Text as="span" variant="secondary" bold>Fichiers</Text>
                    <FileIcon size={20} className="text-kumo-info" />
                  </div>
                  <Text as="p" variant="heading1" DANGEROUS_className="mt-1">
                    {stats.fileCount}
                  </Text>
                </LayerCard>
              </GridItem>

              <GridItem>
                <LayerCard className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between text-kumo-subtle">
                    <Text as="span" variant="secondary" bold>Dossiers</Text>
                    <FolderIcon size={20} className="text-kumo-info" />
                  </div>
                  <Text as="p" variant="heading1" DANGEROUS_className="mt-1">
                    {stats.folderCount}
                  </Text>
                </LayerCard>
              </GridItem>

              <GridItem>
                <LayerCard className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between text-kumo-subtle">
                    <Text as="span" variant="secondary" bold>Espace total</Text>
                    <HardDriveIcon size={20} className="text-kumo-info" />
                  </div>
                  <Text as="p" variant="heading1" DANGEROUS_className="mt-1">
                    {formatFileSize(stats.usedBytes)}
                  </Text>
                  <Text as="span" variant="secondary" bold>
                    {formatFileSize(stats.quotaBytes)}
                  </Text>
                </LayerCard>
              </GridItem>

              <GridItem>
                <LayerCard className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between text-kumo-subtle">
                    <Text as="span" variant="secondary" bold>Corbeille</Text>
                    <TrashIcon size={20} className="text-kumo-danger" />
                  </div>
                  <Text as="p" variant="heading1" DANGEROUS_className="mt-1">
                    {formatFileSize(stats.trashBytes)}
                  </Text>
                  <Text as="span" variant="secondary" bold>{stats.trashCount} élément(s)</Text>
                </LayerCard>
              </GridItem>
            </Grid>
          </>
        )}
      </div>
    </div>
  );
}
