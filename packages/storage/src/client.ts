import { Client } from "minio";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export const minioClient = new Client({
  endPoint: requireEnv("S3_ENDPOINT"),
  port: Number(process.env.S3_PORT ?? "9000"),
  useSSL: process.env.S3_USE_SSL === "true",
  accessKey: requireEnv("S3_ACCESS_KEY"),
  secretKey: requireEnv("S3_SECRET_KEY"),
});

export const S3_BUCKET = requireEnv("S3_BUCKET");
