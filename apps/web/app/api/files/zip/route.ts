import { NextResponse } from "next/server";
import { headers } from "next/headers";
import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { db, workspace, folder, file, trashItem, eq, and, isNull, inArray } from "@filecloud/db";
import { minioClient, S3_BUCKET } from "@filecloud/storage";

async function getActiveWorkspace(session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>) {
  const activeOrgId = session.session.activeOrganizationId;
  if (activeOrgId) {
    const found = await db.select().from(workspace).where(eq(workspace.organizationId, activeOrgId)).limit(1);
    return found[0];
  }
  const found = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.ownerId, session.user.id), isNull(workspace.organizationId)))
    .limit(1);
  return found[0];
}

// Recursively adds a folder's files (and empty subfolders) under `basePath`
// in the zip, skipping anything currently in the trash.
async function addFolderToZip(
  zip: JSZip,
  folderId: string,
  basePath: string,
  workspaceId: string,
  trashedIds: Set<string>,
) {
  const [subfolders, files] = await Promise.all([
    db.select().from(folder).where(and(eq(folder.parentId, folderId), eq(folder.workspaceId, workspaceId))),
    db.select().from(file).where(and(eq(file.folderId, folderId), eq(file.workspaceId, workspaceId))),
  ]);

  zip.folder(basePath);

  for (const sub of subfolders) {
    if (trashedIds.has(sub.id)) continue;
    await addFolderToZip(zip, sub.id, `${basePath}${sub.name}/`, workspaceId, trashedIds);
  }

  for (const f of files) {
    if (trashedIds.has(f.id)) continue;
    try {
      const stream = await minioClient.getObject(S3_BUCKET, f.storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      zip.file(`${basePath}${f.name}`, Buffer.concat(chunks));
    } catch (err) {
      console.warn(`[zip] Skipping unreadable file ${f.id}:`, err);
    }
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemsParam = searchParams.get("items");
    if (!itemsParam) {
      return NextResponse.json({ error: "Missing items" }, { status: 400 });
    }

    const requested = itemsParam
      .split(",")
      .map((entry) => {
        const [id, type] = entry.split(":");
        return id && (type === "file" || type === "folder") ? { id, type: type as "file" | "folder" } : null;
      })
      .filter((entry): entry is { id: string; type: "file" | "folder" } => entry !== null);

    if (requested.length === 0) {
      return NextResponse.json({ error: "No valid items" }, { status: 400 });
    }

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const trashedRows = await db
      .select({ itemId: trashItem.itemId })
      .from(trashItem)
      .where(eq(trashItem.workspaceId, wsRecord.id));
    const trashedIds = new Set(trashedRows.map((t) => t.itemId));

    const folderIds = requested.filter((r) => r.type === "folder").map((r) => r.id);
    const fileIds = requested.filter((r) => r.type === "file").map((r) => r.id);

    const [dbFolders, dbFiles] = await Promise.all([
      folderIds.length > 0
        ? db.select().from(folder).where(and(inArray(folder.id, folderIds), eq(folder.workspaceId, wsRecord.id)))
        : Promise.resolve([]),
      fileIds.length > 0
        ? db.select().from(file).where(and(inArray(file.id, fileIds), eq(file.workspaceId, wsRecord.id)))
        : Promise.resolve([]),
    ]);

    const activeFolders = dbFolders.filter((f) => !trashedIds.has(f.id));
    const activeFiles = dbFiles.filter((f) => !trashedIds.has(f.id));

    if (activeFolders.length === 0 && activeFiles.length === 0) {
      return NextResponse.json({ error: "Nothing to compress" }, { status: 404 });
    }

    const zip = new JSZip();

    for (const f of activeFolders) {
      await addFolderToZip(zip, f.id, `${f.name}/`, wsRecord.id, trashedIds);
    }

    for (const f of activeFiles) {
      try {
        const stream = await minioClient.getObject(S3_BUCKET, f.storageKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        zip.file(f.name, Buffer.concat(chunks));
      } catch (err) {
        console.warn(`[zip] Skipping unreadable file ${f.id}:`, err);
      }
    }

    const zipBuffer = (await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })) as Buffer;

    const zipName =
      activeFolders.length + activeFiles.length === 1
        ? `${(activeFolders[0] ?? activeFiles[0])!.name}.zip`
        : "archive.zip";

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[GET /api/files/zip Error]:", error);
    return NextResponse.json({ error: "Failed to create zip" }, { status: 500 });
  }
}
