import { NextResponse } from "next/server";
import { db, folder, file, trashItem, eq } from "@filecloud/db";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { STORAGE_QUOTA_BYTES, workspaceUsedBytes } from "@/lib/services/quota";

type Category = "images" | "documents" | "videos" | "other";

function categorize(mimeType: string): Category {
  if (mimeType.startsWith("image/")) return "images";
  if (mimeType.startsWith("video/")) return "videos";
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation")
  ) {
    return "documents";
  }
  return "other";
}

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const wsRecord = ctx.workspace;

    const trashedRows = await db
      .select({ itemId: trashItem.itemId })
      .from(trashItem)
      .where(eq(trashItem.workspaceId, wsRecord.id));
    const trashedIds = new Set(trashedRows.map((t) => t.itemId));

    const allFiles = await db
      .select({ id: file.id, size: file.size, mimeType: file.mimeType })
      .from(file)
      .where(eq(file.workspaceId, wsRecord.id));
    const activeFiles = allFiles.filter((f) => !trashedIds.has(f.id));
    const trashedFiles = allFiles.filter((f) => trashedIds.has(f.id));

    const allFolders = await db
      .select({ id: folder.id, name: folder.name })
      .from(folder)
      .where(eq(folder.workspaceId, wsRecord.id));
    const folderCount = allFolders.filter((f) => f.name !== "root" && !trashedIds.has(f.id)).length;

    const categories: Record<Category, number> = { images: 0, documents: 0, videos: 0, other: 0 };
    for (const f of activeFiles) {
      categories[categorize(f.mimeType)] += f.size;
    }

    const usedBytes = await workspaceUsedBytes(wsRecord.id);
    const trashBytes = trashedFiles.reduce((sum, f) => sum + f.size, 0);

    return NextResponse.json({
      usedBytes,
      quotaBytes: STORAGE_QUOTA_BYTES,
      fileCount: activeFiles.length,
      folderCount,
      trashBytes,
      trashCount: trashedFiles.length,
      categories,
    });
  } catch (error) {
    return jsonError(error, "Failed to fetch storage stats");
  }
}
