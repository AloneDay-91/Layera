import { Client } from "minio";
import { Readable } from "node:stream";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

function createClient(endPoint: string, port: number, useSSL: boolean) {
  return new Client({
    endPoint,
    port,
    useSSL,
    accessKey: requireEnv("S3_ACCESS_KEY"),
    secretKey: requireEnv("S3_SECRET_KEY"),
  });
}

export const minioClient = createClient(
  requireEnv("S3_ENDPOINT"),
  Number(process.env.S3_PORT ?? "9000"),
  process.env.S3_USE_SSL === "true",
);

export const S3_BUCKET = requireEnv("S3_BUCKET");

function parsePublicEndpoint() {
  const raw = process.env.S3_PUBLIC_ENDPOINT;
  if (!raw) return null;
  const url = new URL(raw);
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
    useSSL: url.protocol === "https:",
  };
}

const publicEndpoint = parsePublicEndpoint();

export const minioPresignClient = publicEndpoint
  ? createClient(publicEndpoint.endPoint, publicEndpoint.port, publicEndpoint.useSSL)
  : minioClient;

export const usesPublicPresign = publicEndpoint !== null;

export function objectStorageKey(workspaceId: string, objectId: string) {
  return `workspaces/${workspaceId}/${objectId}`;
}

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(S3_BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(S3_BUCKET);
  }
}

export async function presignPutObject(storageKey: string, expirySeconds: number, contentType: string) {
  return minioPresignClient.presignedUrl("PUT", S3_BUCKET, storageKey, expirySeconds, {
    "Content-Type": contentType,
  });
}

export async function statStoredObject(storageKey: string) {
  return minioClient.statObject(S3_BUCKET, storageKey);
}

export async function putStoredObject(
  storageKey: string,
  body: Buffer | Readable,
  size: number,
  contentType: string,
) {
  await minioClient.putObject(S3_BUCKET, storageKey, body, size, {
    "Content-Type": contentType,
  });
}

export async function copyStoredObject(sourceKey: string, destKey: string) {
  await minioClient.copyObject(S3_BUCKET, destKey, `/${S3_BUCKET}/${sourceKey}`);
}

export async function getStoredObjectStream(storageKey: string): Promise<Readable> {
  return minioClient.getObject(S3_BUCKET, storageKey);
}

export async function getStoredObjectRange(
  storageKey: string,
  offset: number,
  length: number,
): Promise<Readable> {
  return minioClient.getPartialObject(S3_BUCKET, storageKey, offset, length);
}

export function nodeStreamToWeb(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export async function readStoredObjectPrefix(storageKey: string, length: number): Promise<Buffer> {
  const stream = await minioClient.getPartialObject(S3_BUCKET, storageKey, 0, length);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function removeStoredObject(storageKey: string) {
  await minioClient.removeObject(S3_BUCKET, storageKey).catch(() => undefined);
}

export async function removeStoredObjects(storageKeys: string[]) {
  const unique = [...new Set(storageKeys.filter(Boolean))];
  const chunkSize = 1000;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    await minioClient.removeObjects(S3_BUCKET, chunk).catch(() => undefined);
  }
}

export async function listStoredObjectKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  const stream = minioClient.listObjectsV2(S3_BUCKET, prefix, true);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (obj) => {
      if (obj.name) keys.push(obj.name);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return keys;
}

export async function removeStoredPrefix(prefix: string) {
  const keys = await listStoredObjectKeys(prefix);
  await removeStoredObjects(keys);
}
