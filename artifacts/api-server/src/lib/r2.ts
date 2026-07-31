import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function makeClient(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a buffer to R2 and return the public URL (or a proxy key when no
 * public bucket URL is configured).
 *
 * The stored URL shape:
 *  - Public bucket:  https://pub-xxxx.r2.dev/<key>
 *  - No public URL:  r2:<key>   (served via /api/uploads/r2/:key)
 */
export async function uploadToR2(
  buffer: Buffer,
  key: string,
  mimeType: string,
): Promise<string> {
  const client = makeClient();
  if (!client) throw new Error("R2 is not configured");

  const bucket = process.env.R2_BUCKET_NAME!;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  // If no public URL, use the API proxy route with a query param (avoids
  // path-to-regexp v8 wildcard limitations in Express 5).
  return publicBase ? `${publicBase}/${key}` : `r2:${encodeURIComponent(key)}`;
}

// ---------------------------------------------------------------------------
// Presigned download URL (used when the bucket is private)
// ---------------------------------------------------------------------------

/** Returns a presigned GET URL valid for 1 hour. */
export async function getPresignedUrl(key: string): Promise<string> {
  const client = makeClient();
  if (!client) throw new Error("R2 is not configured");

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }),
    { expiresIn: 3600 },
  );
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteFromR2(key: string): Promise<void> {
  const client = makeClient();
  if (!client) return;

  await client.send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the R2 object key from a stored URL value.
 * Returns null if the URL is not an R2-managed value.
 */
export function extractR2Key(url: string): string | null {
  // Internal proxy format:  r2:<encoded-key>
  if (url.startsWith("r2:")) return decodeURIComponent(url.slice(3));

  // Public bucket URL format: https://pub-xxxx.r2.dev/<key>
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (publicBase && url.startsWith(publicBase + "/")) {
    return url.slice(publicBase.length + 1);
  }

  return null;
}
