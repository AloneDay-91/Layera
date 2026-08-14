"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { Breadcrumbs } from "@cloudflare/kumo";

export type BreadcrumbSegment = {
  id: string | null;
  name: string;
};

type FileBreadcrumbsProps = {
  path: BreadcrumbSegment[];
  onNavigate: (folderId: string | null) => void;
  onMoveItem?: (
    draggedItem: { id: string; type: "file" | "folder"; name: string },
    targetFolderId: string | null,
  ) => void;
};

export function FileBreadcrumbs({ path, onNavigate, onMoveItem }: FileBreadcrumbsProps) {
  const [hoveredTargetId, setHoveredTargetId] = useState<string | "root" | null>(null);
  const t = useTranslations("fileBreadcrumbs");

  function handleDropOnSegment(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault();
    setHoveredTargetId(null);
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;
    try {
      const dragged = JSON.parse(dataStr);
      if (dragged.id && dragged.id !== targetFolderId && onMoveItem) {
        onMoveItem(dragged, targetFolderId);
      }
    } catch (err) {
      console.error("Error handling drop on breadcrumb:", err);
    }
  }

  const isRootHovered = hoveredTargetId === "root";

  return (
    <Breadcrumbs size="sm">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        onDragOver={(e) => {
          e.preventDefault();
          setHoveredTargetId("root");
        }}
        onDragLeave={() => setHoveredTargetId(null)}
        onDrop={(e) => handleDropOnSegment(e, null)}
        className={
          isRootHovered
            ? "text-sm text-kumo-strong font-semibold bg-kumo-tint px-2 py-0.5 rounded border border-dashed border-kumo-info"
            : "text-sm text-kumo-subtle hover:text-kumo-default hover:underline"
        }
      >
        {t("myFiles")}
      </button>

      {path.map((folder, index) => {
        const isLast = index === path.length - 1;
        const isHovered = hoveredTargetId === folder.id;

        return (
          <Fragment key={folder.id ?? index}>
            <Breadcrumbs.Separator />
            {isLast ? (
              <span
                onDragOver={(e) => {
                  e.preventDefault();
                  if (folder.id) setHoveredTargetId(folder.id);
                }}
                onDragLeave={() => setHoveredTargetId(null)}
                onDrop={(e) => handleDropOnSegment(e, folder.id)}
                className={
                  isHovered
                    ? "text-sm font-semibold bg-kumo-tint px-2 py-0.5 rounded border border-dashed border-kumo-info"
                    : "text-sm"
                }
              >
                <Breadcrumbs.Current>{folder.name}</Breadcrumbs.Current>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(folder.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (folder.id) setHoveredTargetId(folder.id);
                }}
                onDragLeave={() => setHoveredTargetId(null)}
                onDrop={(e) => handleDropOnSegment(e, folder.id)}
                className={
                  isHovered
                    ? "text-sm text-kumo-strong font-semibold bg-kumo-tint px-2 py-0.5 rounded border border-dashed border-kumo-info"
                    : "text-sm text-kumo-subtle hover:text-kumo-default hover:underline"
                }
              >
                {folder.name}
              </button>
            )}
          </Fragment>
        );
      })}
    </Breadcrumbs>
  );
}
