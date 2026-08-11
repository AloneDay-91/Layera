import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, folder, file, trashItem, eq, and, isNull } from "@filecloud/db";

// Soft, display-only quota — there is no enforcement or per-workspace
// configuration yet, this only drives the storage meter's percentage.
const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

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
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrgId = session.session.activeOrganizationId;
    let wsRecord;
    if (activeOrgId) {
      const found = await db
        .select()
        .from(workspace)
        .where(eq(workspace.organizationId, activeOrgId))
        .limit(1);
      wsRecord = found[0];
    } else {
      const found = await db
        .select()
        .from(workspace)
        .where(and(eq(workspace.ownerId, session.user.id), isNull(workspace.organizationId)))
        .limit(1);
      wsRecord = found[0];
    }

    if (!wsRecord) {
      return NextResponse.json({
        usedBytes: 0,
        quotaBytes: STORAGE_QUOTA_BYTES,
        fileCount: 0,
        folderCount: 0,
        trashBytes: 0,
        trashCount: 0,
        categories: { images: 0, documents: 0, videos: 0, other: 0 },
      });
    }

    const trashedRows = await db
      .select({ itemId: trashItem.itemId })
      .from(trashItem)
      .where(eq(trashItem.workspaceId, wsRecord.id));
    const trashedIds = new Set(trashedRows.map((t) => t.itemId));

    const allFiles = await db.select().from(file).where(eq(file.workspaceId, wsRecord.id));
    const activeFiles = allFiles.filter((f) => !trashedIds.has(f.id));
    const trashedFiles = allFiles.filter((f) => trashedIds.has(f.id));

    const allFolders = await db
      .select({ id: folder.id, name: folder.name })
      .from(folder)
      .where(eq(folder.workspaceId, wsRecord.id));
    const folderCount = allFolders.filter((f) => f.name !== "root" && !trashedIds.has(f.id)).length;

    const categories: Record<Category, number> = { images: 0, documents: 0, videos: 0, other: 0 };
    let usedBytes = 0;
    for (const f of activeFiles) {
      usedBytes += f.size;
      categories[categorize(f.mimeType)] += f.size;
    }

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
    console.error("[GET /api/storage/stats Error]:", error);
    return NextResponse.json({ error: "Failed to fetch storage stats" }, { status: 500 });
  }
}
