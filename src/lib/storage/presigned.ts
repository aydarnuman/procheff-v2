/**
 * Presigned helper - DEV fallback.
 *
 * Production: replace createLocalUploadUrl with cloud presigned URL generator
 * using @google-cloud/storage or aws-sdk S3.getSignedUrlPromise.
 *
 * Example (GCS):
 *   const { Storage } = require('@google-cloud/storage');
 *   const storage = new Storage();
 *   const bucket = storage.bucket(process.env.GCS_BUCKET);
 *   const file = bucket.file(key);
 *   const [url] = await file.getSignedUrl({ action: 'write', expires: Date.now()+60*60*1000, contentType });
 */
import { randomUUID } from "crypto";

export function createLocalUploadUrl(analysisId: string, filename: string) {
  // Return a dev upload endpoint that will accept multipart/form-data for this analysisId
  // In prod, return presigned cloud storage URL instead.
  const uploadPath = `/api/analysis/upload-local?analysisId=${encodeURIComponent(analysisId)}&filename=${encodeURIComponent(filename)}&uploadId=${randomUUID()}`;
  return { uploadUrl: uploadPath, method: "POST", expiresIn: 3600 };
}
