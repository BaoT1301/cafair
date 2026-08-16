/**
 * Database keep-alive.
 * ────────────────────────────────────────────────────────────────────────
 * Supabase pauses a free project after ~7 days with no database activity.
 * This endpoint issues a real query so the project registers as in use.
 *
 * WHY A ROUTE AND NOT setInterval IN instrumentation.ts
 * The in-process-timer pattern needs a container that runs continuously. This
 * app deploys to Vercel, which is serverless: the function is frozen once a
 * response is returned, so a `setInterval` registered at boot fires
 * unpredictably or not at all. It would pass review and silently do nothing.
 * Vercel Cron invokes this route on a schedule instead (see vercel.json).
 *
 * WHY A DATABASE QUERY AND NOT AN HTTP PING
 * Requesting a page proves nothing. The landing page, sign-in screen and every
 * statically rendered route never open a Postgres connection — a project can
 * serve traffic all week and still be paused for inactivity. Only a query
 * counts.
 *
 * `candidates` is queried rather than `SELECT 1` because counting a real table
 * additionally proves the connection can still read application data, not just
 * that a socket opened.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// Must not be statically evaluated at build time — it has to run per request.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` automatically
  // when CRON_SECRET is set on the project.
  //
  // Fails closed: with no secret configured the endpoint is disabled rather
  // than left open. It opens a database connection, so an unauthenticated
  // version would be a free amplification primitive — cheap for an attacker to
  // call, not free for the database.
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET is not configured. Set it in the Vercel project so scheduled invocations can authenticate.",
      },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const result = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from candidates`,
    );

    // Drizzle returns either an array or a { rows } object depending on driver.
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
    const count = (rows[0] as { count?: number } | undefined)?.count ?? null;

    const durationMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({ msg: "Database keep-alive ping succeeded", candidates: count, durationMs }),
    );

    return NextResponse.json({
      ok: true,
      candidates: count,
      durationMs,
      at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ msg: "Database keep-alive ping FAILED", error: message }));

    // 500 so a failed ping shows up red in Vercel's cron history rather than
    // being mistaken for a healthy run.
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
