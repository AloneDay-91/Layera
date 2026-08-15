import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  ensureBucket,
  getStoredObjectStream,
  nodeStreamToWeb,
  putStoredObject,
  removeStoredObject,
  statStoredObject,
} from "@filecloud/storage";
import { contentDisposition } from "@/lib/http-file";

// SVG is deliberately excluded — it can embed <script> and executes it when
// navigated to directly (Content-Disposition: inline), unlike raster formats.
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

function avatarStorageKey(userId: string) {
  return `avatars/${userId}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
      const storageKey = avatarStorageKey(userId);
      const stat = await statStoredObject(storageKey);
      const contentType = stat.metaData?.["content-type"] ?? "application/octet-stream";
      if (!ALLOWED_AVATAR_MIME_TYPES.has(contentType)) {
        return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
      }

      const stream = await getStoredObjectStream(storageKey);
      const responseHeaders: Record<string, string> = {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition("inline", "avatar"),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      };
      if (typeof stat.size === "number" && stat.size > 0) {
        responseHeaders["Content-Length"] = String(stat.size);
      }

      return new NextResponse(nodeStreamToWeb(stream), { headers: responseHeaders });
    } catch {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("[GET /api/profile/avatar Error]:", error);
    return NextResponse.json({ error: "Failed to load avatar" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const uploadedFile = formData.get("file") as File | null;

    if (!uploadedFile) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!ALLOWED_AVATAR_MIME_TYPES.has(uploadedFile.type)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }
    if (uploadedFile.size > MAX_AVATAR_SIZE) {
      return NextResponse.json({ error: "Image too large (5 MB max)" }, { status: 400 });
    }

    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const storageKey = avatarStorageKey(session.user.id);

    await ensureBucket();
    await putStoredObject(storageKey, buffer, buffer.length, uploadedFile.type);

    const imageUrl = `/api/profile/avatar?userId=${session.user.id}&t=${Date.now()}`;
    return NextResponse.json({ success: true, image: imageUrl });
  } catch (error) {
    console.error("[POST /api/profile/avatar Error]:", error);
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await removeStoredObject(avatarStorageKey(session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/profile/avatar Error]:", error);
    return NextResponse.json({ error: "Failed to remove avatar" }, { status: 500 });
  }
}
