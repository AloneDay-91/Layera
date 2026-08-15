import { db, file, eq } from "@filecloud/db";
import {
  getStoredObjectStream,
  putStoredObject,
  thumbnailStorageKey,
} from "@filecloud/storage";
import sharp from "sharp";

const THUMB_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function generateThumbnail(fileId: string) {
  const [row] = await db.select().from(file).where(eq(file.id, fileId)).limit(1);
  if (!row) return;
  if (row.thumbnailKey) return;
  if (!THUMB_MIMES.has(row.mimeType)) return;

  const source = await getStoredObjectStream(row.storageKey);
  const chunks: Buffer[] = [];
  for await (const chunk of source) {
    chunks.push(Buffer.from(chunk));
  }

  const thumb = await sharp(Buffer.concat(chunks))
    .rotate()
    .resize(256, 256, { fit: "cover" })
    .webp({ quality: 72 })
    .toBuffer();

  const key = thumbnailStorageKey(row.storageKey);
  await putStoredObject(key, thumb, thumb.length, "image/webp");
  await db.update(file).set({ thumbnailKey: key, updatedAt: new Date() }).where(eq(file.id, row.id));
}
