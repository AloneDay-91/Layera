"use client";

import { Fragment } from "react";
import { Breadcrumbs } from "@cloudflare/kumo";
import type { MockItem } from "@/lib/mock-files";

export function FileBreadcrumbs({
  path,
  onNavigate,
}: {
  path: MockItem[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <Breadcrumbs>
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
      >
        Mes fichiers
      </button>
      {path.map((folder, index) => {
        const isLast = index === path.length - 1;
        return (
          <Fragment key={folder.id}>
            <Breadcrumbs.Separator />
            {isLast ? (
              <Breadcrumbs.Current>{folder.name}</Breadcrumbs.Current>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(folder.id)}
                className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
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
