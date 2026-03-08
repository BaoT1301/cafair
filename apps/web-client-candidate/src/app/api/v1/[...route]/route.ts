/**
 * Next.js App Router — Hono Public API v1 catch-all
 *
 * Delegates all /api/v1/* requests to the Hono app.
 */

import { handle } from "hono/vercel";
import app from "@/server/hono/app";

export const runtime = "nodejs";

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
