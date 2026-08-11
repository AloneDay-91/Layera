"use client";

import { useMemo, useState } from "react";
import { Tabs, useKumoToastManager } from "@cloudflare/kumo";
import { GridFourIcon, ListBulletsIcon } from "@phosphor-icons/react";
import { MOCK_ITEMS, getChildren, getBreadcrumbPath } from "@/lib/mock-files";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { FileTable } from "./file-table";
import { FileGrid } from "./file-grid";
import { FileDetailsPanel } from "./file-details-panel";
import { UploadDropzone } from "./upload-dropzone";

type ViewMode = "table" | "grid";

export function FileBrowser() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const toasts = useKumoToastManager();

  const items = useMemo(() => getChildren(MOCK_ITEMS, currentFolderId), [currentFolderId]);
  const breadcrumbPath = useMemo(() => getBreadcrumbPath(MOCK_ITEMS, currentFolderId), [currentFolderId]);
  const selectedItem = useMemo(
    () => MOCK_ITEMS.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId],
  );

  function handleOpenFolder(folderId: string) {
    setCurrentFolderId(folderId);
    setSelectedItemId(null);
  }

  function handleNavigate(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedItemId(null);
  }

  function handleDetailAction(action: string) {
    toasts.add({
      title: "Bientôt disponible",
      description: `"${action}" n'est pas encore implémenté.`,
    });
  }

  return (
    <div className="flex flex-1 gap-6">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <FileBreadcrumbs path={breadcrumbPath} onNavigate={handleNavigate} />
          <Tabs
            variant="segmented"
            size="sm"
            tabs={[
              {
                value: "table",
                label: (
                  <span className="flex items-center gap-1">
                    <ListBulletsIcon size={16} /> Liste
                  </span>
                ),
              },
              {
                value: "grid",
                label: (
                  <span className="flex items-center gap-1">
                    <GridFourIcon size={16} /> Grille
                  </span>
                ),
              },
            ]}
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
          />
        </div>

        {items.length === 0 ? (
          <UploadDropzone />
        ) : viewMode === "table" ? (
          <FileTable
            items={items}
            selectedItemId={selectedItemId}
            onOpenFolder={handleOpenFolder}
            onSelectItem={setSelectedItemId}
          />
        ) : (
          <FileGrid
            items={items}
            selectedItemId={selectedItemId}
            onOpenFolder={handleOpenFolder}
            onSelectItem={setSelectedItemId}
          />
        )}
      </div>

      {selectedItem && (
        <FileDetailsPanel
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
          onAction={handleDetailAction}
        />
      )}
    </div>
  );
}
