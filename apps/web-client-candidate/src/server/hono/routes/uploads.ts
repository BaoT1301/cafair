/**
 * Uploads — Mobile REST routes
 *
 * Handles multipart file uploads to Supabase Storage.
 * Files are scoped under `{userId}/files/`.
 *
 * Endpoints:
 *   POST   /uploads/file     — Upload a single file
 *   GET    /uploads/files    — List all user files
 *   DELETE /uploads/files    — Delete all user files
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthEnv } from "../middleware";
import {
  uploadFile,
  getFileUrls,
  deleteFiles,
  validateImageFile,
  UploadError,
} from "@/services/uploads/storage";

const app = new Hono<AuthEnv>();

// ── POST /uploads/file ──────────────────────────────────────────────────
// Accepts multipart/form-data with a single `file` field.
app.post("/file", async (c) => {
  const userId = c.var.userId;

  try {
    const contentType = c.req.header("content-type") ?? "";

    if (!contentType.includes("multipart/form-data")) {
      throw new HTTPException(400, {
        message: `Expected multipart/form-data, got: ${contentType || "(none)"}`,
      });
    }

    const formData = await c.req.formData();
    const raw = formData.get("file");

    if (!raw) {
      throw new HTTPException(400, {
        message: "Missing 'file' field in form data",
      });
    }

    if (typeof raw === "string") {
      throw new HTTPException(400, {
        message:
          "File was received as text. " +
          "Ensure the client sends the file with a filename in FormData.",
      });
    }

    const file = raw as File;

    // Validate file type and size
    validateImageFile(file.type, file.size);

    // Convert File/Blob to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFile(
      userId,
      buffer,
      file.name || `file-${Date.now()}.jpg`,
      file.type,
    );

    return c.json({ data: result }, 201);
  } catch (error) {
    if (error instanceof UploadError) {
      throw new HTTPException(error.statusCode as 400 | 500, {
        message: error.message,
      });
    }
    throw error;
  }
});

// ── GET /uploads/files ──────────────────────────────────────────────────
app.get("/files", async (c) => {
  const userId = c.var.userId;

  try {
    const files = await getFileUrls(userId);
    return c.json({ data: files });
  } catch (error) {
    if (error instanceof UploadError) {
      throw new HTTPException(error.statusCode as 400 | 500, {
        message: error.message,
      });
    }
    throw error;
  }
});

// ── DELETE /uploads/files ───────────────────────────────────────────────
app.delete("/files", async (c) => {
  const userId = c.var.userId;

  try {
    await deleteFiles(userId);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof UploadError) {
      throw new HTTPException(error.statusCode as 400 | 500, {
        message: error.message,
      });
    }
    throw error;
  }
});

export default app;
