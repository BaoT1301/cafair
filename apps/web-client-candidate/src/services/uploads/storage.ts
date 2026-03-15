/**
 * Upload Service — Supabase Storage operations
 *
 * Generic file upload, list, and delete operations scoped per user.
 * Storage path: `{userId}/files/{timestamp}-{fileName}`
 */

import { supabaseAdmin, USER_UPLOADS_BUCKET } from "@/lib/supabase";

// ── Constants ───────────────────────────────────────────────────────────

const FILES_PREFIX = "files";
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Types ───────────────────────────────────────────────────────────────

export type UploadResult = {
  url: string;
  path: string;
};

export class UploadError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

// ── Validation ──────────────────────────────────────────────────────────

export function validateImageFile(mimeType: string, size: number): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new UploadError(
      400,
      `Invalid file type: ${mimeType}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
    );
  }
  if (size > MAX_FILE_SIZE) {
    throw new UploadError(
      400,
      `File too large: ${(size / 1024 / 1024).toFixed(1)}MB. Max: 10MB`,
    );
  }
}

// ── Upload ──────────────────────────────────────────────────────────────

/**
 * Upload a single file for a user.
 *
 * Storage path: `{userId}/files/{timestamp}-{fileName}`
 */
export async function uploadFile(
  userId: string,
  file: Buffer | Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<UploadResult> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const storagePath = `${userId}/${FILES_PREFIX}/${timestamp}-${safeName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(USER_UPLOADS_BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    console.error("[upload] Supabase storage error:", error);
    throw new UploadError(500, `Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(USER_UPLOADS_BUCKET).getPublicUrl(data.path);

  return {
    url: publicUrl,
    path: data.path,
  };
}

// ── List ────────────────────────────────────────────────────────────────

/**
 * List all file URLs for a user.
 */
export async function getFileUrls(userId: string): Promise<UploadResult[]> {
  const prefix = `${userId}/${FILES_PREFIX}`;

  const { data, error } = await supabaseAdmin.storage
    .from(USER_UPLOADS_BUCKET)
    .list(prefix, {
      sortBy: { column: "created_at", order: "asc" },
    });

  if (error) {
    console.error("[upload] List error:", error);
    throw new UploadError(500, `Failed to list files: ${error.message}`);
  }

  return (data ?? []).map((file) => {
    const path = `${prefix}/${file.name}`;
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(USER_UPLOADS_BUCKET).getPublicUrl(path);

    return { url: publicUrl, path };
  });
}

// ── Delete ──────────────────────────────────────────────────────────────

/**
 * Delete all files for a user.
 */
export async function deleteFiles(userId: string): Promise<void> {
  const prefix = `${userId}/${FILES_PREFIX}`;

  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(USER_UPLOADS_BUCKET)
    .list(prefix);

  if (listError) {
    console.error("[upload] List error for deletion:", listError);
    throw new UploadError(
      500,
      `Failed to list files for deletion: ${listError.message}`,
    );
  }

  if (!files || files.length === 0) return;

  const paths = files.map((f) => `${prefix}/${f.name}`);

  const { error: deleteError } = await supabaseAdmin.storage
    .from(USER_UPLOADS_BUCKET)
    .remove(paths);

  if (deleteError) {
    console.error("[upload] Delete error:", deleteError);
    throw new UploadError(
      500,
      `Failed to delete files: ${deleteError.message}`,
    );
  }
}
