import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, folder, file, shareLink, eq, and, isNull } from "@filecloud/db";
import { randomBytes } from "crypto";
import { hashSharePassword } from "@/lib/share-password";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

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

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ shares: [] });
    }

    const shares = await db
      .select()
      .from(shareLink)
      .where(
        and(
          eq(shareLink.workspaceId, wsRecord.id),
          eq(shareLink.createdBy, session.user.id),
          isNull(shareLink.revokedAt),
        ),
      );

    const result = [];
    for (const s of shares) {
      let itemName = "Élément";
      let itemType: "file" | "folder" = "file";

      if (s.fileId) {
        const [f] = await db.select().from(file).where(eq(file.id, s.fileId)).limit(1);
        if (f) {
          itemName = f.name;
          itemType = "file";
        }
      } else if (s.folderId) {
        const [fld] = await db.select().from(folder).where(eq(folder.id, s.folderId)).limit(1);
        if (fld) {
          itemName = fld.name;
          itemType = "folder";
        }
      }

      result.push({
        id: s.id,
        token: s.token,
        itemName,
        itemType,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
        hasPassword: s.passwordHash !== null,
      });
    }

    return NextResponse.json({ shares: result });
  } catch (error) {
    console.error("[GET /api/shares Error]:", error);
    return NextResponse.json({ error: "Failed to fetch share links" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, retryAfter } = await checkRateLimit(`share-create:${session.user.id}`, {
      windowSeconds: 60,
      max: 20,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { itemId, itemType, expiresAt, password } = await request.json();

    if (!itemId || !itemType) {
      return NextResponse.json({ error: "Missing itemId or itemType" }, { status: 400 });
    }

    const wsRecord = await getActiveWorkspace(session);

    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (itemType === "file") {
      const [f] = await db.select().from(file).where(eq(file.id, itemId)).limit(1);
      if (!f || f.workspaceId !== wsRecord.id) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    } else {
      const [fld] = await db.select().from(folder).where(eq(folder.id, itemId)).limit(1);
      if (!fld || fld.workspaceId !== wsRecord.id) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    if (expiresAt !== undefined && expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) {
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
    }

    const token = randomBytes(12).toString("hex");

    const values: {
      token: string;
      createdBy: string;
      workspaceId: string;
      fileId?: string;
      folderId?: string;
      expiresAt?: Date;
      passwordHash?: string;
    } = {
      token,
      createdBy: session.user.id,
      workspaceId: wsRecord.id,
    };

    if (itemType === "file") {
      values.fileId = itemId;
    } else {
      values.folderId = itemId;
    }

    if (expiresAt) {
      values.expiresAt = new Date(expiresAt);
    }
    if (typeof password === "string" && password.length > 0) {
      values.passwordHash = hashSharePassword(password);
    }

    const [newShare] = await db.insert(shareLink).values(values).returning();

    return NextResponse.json({
      success: true,
      share: {
        id: newShare?.id,
        token: newShare?.token,
        url: `/share/${newShare?.token}`,
      },
    });
  } catch (error) {
    console.error("[POST /api/shares Error]:", error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, expiresAt, password } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(shareLink)
      .where(and(eq(shareLink.id, id), eq(shareLink.createdBy, session.user.id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    const updateData: { expiresAt?: Date | null; passwordHash?: string | null } = {};

    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        updateData.expiresAt = null;
      } else if (Number.isNaN(Date.parse(expiresAt))) {
        return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
      } else {
        updateData.expiresAt = new Date(expiresAt);
      }
    }

    if (password !== undefined) {
      updateData.passwordHash = typeof password === "string" && password.length > 0 ? hashSharePassword(password) : null;
    }

    const [updated] = await db.update(shareLink).set(updateData).where(eq(shareLink.id, id)).returning();

    return NextResponse.json({
      success: true,
      share: {
        id: updated?.id,
        expiresAt: updated?.expiresAt ? updated.expiresAt.toISOString() : null,
        hasPassword: updated?.passwordHash !== null,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/shares Error]:", error);
    return NextResponse.json({ error: "Failed to update share link" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get("id");

    if (!shareId) {
      return NextResponse.json({ error: "Missing shareId" }, { status: 400 });
    }

    await db
      .update(shareLink)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLink.id, shareId), eq(shareLink.createdBy, session.user.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/shares Error]:", error);
    return NextResponse.json({ error: "Failed to revoke share link" }, { status: 500 });
  }
}
