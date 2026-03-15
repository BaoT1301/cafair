/**
 * Next.js App Router — Hono Mobile API catch-all
 *
 * Delegates all /api/mobile/* requests to the Hono app.
 */

import { handle } from "hono/vercel";
import app from "@/server/hono/app";

// Use Node.js runtime for full multipart/formData support
export const runtime = "nodejs";

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
