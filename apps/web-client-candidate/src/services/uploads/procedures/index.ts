/**
 * Uploads tRPC Router
 *
 * Generic file upload/list/delete via base64 encoding (web clients).
 * For mobile multipart uploads, use the Hono REST endpoint instead.
 */

import { authedProcedure, createTRPCRouter } from "@/server/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  uploadFile,
  getFileUrls,
  deleteFiles,
  validateImageFile,
  type UploadResult,
} from "@/services/uploads/storage";

// ── Input schemas ───────────────────────────────────────────────────────

const uploadInput = z.object({
  /** Base64-encoded image data (without data URI prefix) */
  base64: z.string().min(1, "Image data is required"),
  /** Original file name */
  fileName: z.string().min(1).max(255),
  /** MIME type */
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
});

// ── Procedures ──────────────────────────────────────────────────────────

const upload = authedProcedure
  .input(uploadInput)
  .mutation(async ({ ctx, input }): Promise<UploadResult> => {
    try {
      const buffer = Buffer.from(input.base64, "base64");
      validateImageFile(input.mimeType, buffer.length);

      return await uploadFile(
        ctx.user.id,
        buffer,
        input.fileName,
        input.mimeType,
      );
    } catch (error) {
      console.error("❌ uploadFile failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to upload file",
      });
    }
  });

const list = authedProcedure.query(async ({ ctx }): Promise<UploadResult[]> => {
  try {
    return await getFileUrls(ctx.user.id);
  } catch (error) {
    console.error("❌ getFiles failed:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to list files",
    });
  }
});

const remove = authedProcedure.mutation(
  async ({ ctx }): Promise<{ success: boolean }> => {
    try {
      await deleteFiles(ctx.user.id);
      return { success: true };
    } catch (error) {
      console.error("❌ deleteFiles failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to delete files",
      });
    }
  },
);

export const uploadsRouter = createTRPCRouter({
  upload,
  list,
  remove,
});
