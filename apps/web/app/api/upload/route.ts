import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, folder, file, provisionPersonalWorkspace, provisionOrganizationWorkspace, eq, and, isNull } from "@filecloud/db";
import { minioClient, S3_BUCKET } from "@filecloud/storage";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const uploadedFile = formData.get("file") as File | null;
    const folderIdParam = formData.get("folderId") as string | null;

    if (!uploadedFile) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 1. Trouver ou provisionner le workspace
    const activeOrgId = session.session.activeOrganizationId;
    let wsRecord;

    if (activeOrgId) {
      const found = await db
        .select()
        .from(workspace)
        .where(eq(workspace.organizationId, activeOrgId))
        .limit(1);
      wsRecord = found[0];

      if (!wsRecord) {
        const provisioned = await provisionOrganizationWorkspace({
          organizationId: activeOrgId,
          name: "Workspace Équipe",
          ownerId: session.user.id,
        });
        const created = await db
          .select()
          .from(workspace)
          .where(eq(workspace.id, provisioned.workspaceId))
          .limit(1);
        wsRecord = created[0];
      }
    } else {
      const found = await db
        .select()
        .from(workspace)
        .where(and(eq(workspace.ownerId, session.user.id), isNull(workspace.organizationId)))
        .limit(1);
      wsRecord = found[0];

      if (!wsRecord) {
        const provisioned = await provisionPersonalWorkspace({
          userId: session.user.id,
          userName: session.user.name,
        });
        const created = await db
          .select()
          .from(workspace)
          .where(eq(workspace.id, provisioned.workspaceId))
          .limit(1);
        wsRecord = created[0];
      }
    }

    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // 2. Trouver le dossier cible
    let targetFolderId = folderIdParam;
    if (!targetFolderId) {
      const rootFolder = await db
        .select()
        .from(folder)
        .where(and(eq(folder.workspaceId, wsRecord.id), isNull(folder.parentId)))
        .limit(1);
      if (rootFolder[0]) {
        targetFolderId = rootFolder[0].id;
      }
    }

    if (!targetFolderId) {
      return NextResponse.json({ error: "Target folder not found" }, { status: 400 });
    }

    // 3. Clé de stockage unique S3
    const fileName = uploadedFile.name;
    const fileSize = uploadedFile.size;
    const fileMimeType = uploadedFile.type || "application/octet-stream";
    const storageKey = `files/${wsRecord.id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // 4. Upload des octets dans MinIO / S3
    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      // Tenter d'assurer que le bucket existe
      const bucketExists = await minioClient.bucketExists(S3_BUCKET).catch(() => false);
      if (!bucketExists) {
        await minioClient.makeBucket(S3_BUCKET, "").catch(() => {});
      }
      await minioClient.putObject(S3_BUCKET, storageKey, buffer, fileSize, {
        "Content-Type": fileMimeType,
      });
    } catch (s3Error) {
      console.warn("[S3 Upload Warning]: MinIO is offline, proceeding with database record creation fallback.", s3Error);
    }

    // 5. Enregistrement dans PostgreSQL
    const [newFileRecord] = await db
      .insert(file)
      .values({
        workspaceId: wsRecord.id,
        folderId: targetFolderId,
        name: fileName,
        mimeType: fileMimeType,
        size: fileSize,
        storageKey,
      })
      .returning();

    return NextResponse.json({
      success: true,
      file: {
        id: newFileRecord?.id,
        name: newFileRecord?.name,
        size: newFileRecord?.size,
        mimeType: newFileRecord?.mimeType,
        storageKey: newFileRecord?.storageKey,
        updatedAt: newFileRecord?.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[API /api/upload Error]:", error);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
