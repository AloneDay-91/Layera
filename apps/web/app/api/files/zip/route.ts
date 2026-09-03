import { NextResponse } from "next/server";
import JSZip from "jszip";
import { db, folder, file, trashItem, eq, and, inArray } from "@filecloud/db";
import { minioClient, S3_BUCKET } from "@filecloud/storage";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { contentDisposition } from "@/lib/http-file";
import { toZipEntryName } from "@/lib/item-name";
import { ServiceError } from "@/lib/services/errors";

const MAX_ZIP_FILES = 500;
const MAX_ZIP_BYTES = 512 * 1024 * 1024;

class ZipBudget {
  files = 0;
  bytes = 0;

  add(size: number) {
    this.files += 1;
    this.bytes += size;
    if (this.files > MAX_ZIP_FILES) {
      throw new ServiceError(413, "Too many files to compress");
    }
    if (this.bytes > MAX_ZIP_BYTES) {
      throw new ServiceError(413, "Archive would be too large");
    }
  }
}

// Recursively adds a folder's files (and empty subfolders) under `basePath`
// in the zip, skipping anything currently in the trash.
async function addFolderToZip(
  zip: JSZip,
  folderId: string,
  basePath: string,
  workspaceId: string,
  trashedIds: Set<string>,
  budget: ZipBudget,
) {
  const [subfolders, files] = await Promise.all([
    db.select().from(folder).where(and(eq(folder.parentId, folderId), eq(folder.workspaceId, workspaceId))),
    db.select().from(file).where(and(eq(file.folderId, folderId), eq(file.workspaceId, workspaceId))),
  ]);

  zip.folder(basePath);

  for (const sub of subfolders) {
    if (trashedIds.has(sub.id)) continue;
    await addFolderToZip(zip, sub.id, `${basePath}${toZipEntryName(sub.name)}/`, workspaceId, trashedIds, budget);
  }

  for (const f of files) {
    if (trashedIds.has(f.id)) continue;
    budget.add(f.size);
    try {
      const stream = await minioClient.getObject(S3_BUCKET, f.storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      zip.file(`${basePath}${toZipEntryName(f.name)}`, Buffer.concat(chunks));
    } catch (err) {
      console.warn(`[zip] Skipping unreadable file ${f.id}:`, err);
    }
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { allowed, retryAfter } = await checkRateLimit(`zip:${ctx.actor.id}`, {
      windowSeconds: 300,
      max: 10,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

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

    const wsRecord = ctx.workspace;

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
    const budget = new ZipBudget();

    for (const f of activeFolders) {
      await addFolderToZip(zip, f.id, `${toZipEntryName(f.name)}/`, wsRecord.id, trashedIds, budget);
    }

    for (const f of activeFiles) {
      budget.add(f.size);
      try {
        const stream = await minioClient.getObject(S3_BUCKET, f.storageKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        zip.file(toZipEntryName(f.name), Buffer.concat(chunks));
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
        "Content-Disposition": contentDisposition("attachment", zipName),
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to create zip");
  }
}
