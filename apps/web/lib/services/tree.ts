import { db, sql, type SQL } from "@filecloud/db";
import { ServiceError } from "./errors";

export type TreeItem = { id: string; type: "file" | "folder" };

async function sqlRows<T extends Record<string, unknown>>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

export async function collectDescendantItems(workspaceId: string, folderId: string): Promise<TreeItem[]> {
  const rows = await sqlRows<{ id: string; type: "file" | "folder" }>(sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM folder WHERE id = ${folderId} AND workspace_id = ${workspaceId}
      UNION ALL
      SELECT f.id
      FROM folder f
      INNER JOIN tree ON f.parent_id = tree.id
      WHERE f.workspace_id = ${workspaceId}
    )
    SELECT id, 'folder'::text AS type FROM tree WHERE id <> ${folderId}
    UNION ALL
    SELECT fl.id, 'file'::text AS type
    FROM file fl
    INNER JOIN tree ON fl.folder_id = tree.id
    WHERE fl.workspace_id = ${workspaceId}
  `);
  return rows;
}

export async function folderAncestorIds(workspaceId: string, folderId: string): Promise<string[]> {
  const rows = await sqlRows<{ id: string }>(sql`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id, 0 AS depth
      FROM folder
      WHERE id = ${folderId} AND workspace_id = ${workspaceId}
      UNION ALL
      SELECT f.id, f.parent_id, chain.depth + 1
      FROM folder f
      INNER JOIN chain ON f.id = chain.parent_id
      WHERE f.workspace_id = ${workspaceId} AND chain.depth < 64
    )
    SELECT id FROM chain
  `);
  return rows.map((row) => row.id);
}

export async function folderBreadcrumbs(
  workspaceId: string,
  folderId: string,
): Promise<Array<{ id: string; name: string }>> {
  return sqlRows<{ id: string; name: string }>(sql`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id, name, 0 AS depth
      FROM folder
      WHERE id = ${folderId} AND workspace_id = ${workspaceId}
      UNION ALL
      SELECT f.id, f.parent_id, f.name, chain.depth + 1
      FROM folder f
      INNER JOIN chain ON f.id = chain.parent_id
      WHERE f.workspace_id = ${workspaceId} AND chain.depth < 64
    )
    SELECT id, name FROM chain WHERE name <> 'root' ORDER BY depth DESC
  `);
}

export async function assertFolderMoveAllowed(workspaceId: string, folderId: string, targetFolderId: string) {
  if (folderId === targetFolderId) {
    throw new ServiceError(400, "Cannot move a folder into itself");
  }

  const ancestors = await folderAncestorIds(workspaceId, targetFolderId);
  if (ancestors.includes(folderId)) {
    throw new ServiceError(400, "Cannot move a folder into one of its descendants");
  }
}
