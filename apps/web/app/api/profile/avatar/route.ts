import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { minioClient, S3_BUCKET } from "@filecloud/storage";

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
      const stat = await minioClient.statObject(S3_BUCKET, avatarStorageKey(userId));
      const contentType = stat.metaData?.["content-type"] ?? "application/octet-stream";
      if (!ALLOWED_AVATAR_MIME_TYPES.has(contentType)) {
        return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
      }

      const stream = await minioClient.getObject(S3_BUCKET, avatarStorageKey(userId));
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
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

    const bucketExists = await minioClient.bucketExists(S3_BUCKET).catch(() => false);
    if (!bucketExists) {
      await minioClient.makeBucket(S3_BUCKET, "").catch(() => {});
    }
    await minioClient.putObject(S3_BUCKET, storageKey, buffer, buffer.length, {
      "Content-Type": uploadedFile.type,
    });

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

    await minioClient.removeObject(S3_BUCKET, avatarStorageKey(session.user.id)).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/profile/avatar Error]:", error);
    return NextResponse.json({ error: "Failed to remove avatar" }, { status: 500 });
  }
}
