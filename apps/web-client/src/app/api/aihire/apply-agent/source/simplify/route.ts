// Path: apps/web-client/src/app/api/aihire/apply-agent/source/simplify/route.ts

import { NextResponse } from "next/server";
import { fetchSimplifySummer2026Jobs } from "@/lib/aihire/apply-agent/fetchSimplifySummer2026Jobs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit") ?? "25");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 25;

    const jobs = await fetchSimplifySummer2026Jobs(limit);

    return NextResponse.json({
      ok: true,
      source: "simplify",
      total: jobs.length,
      jobs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch Simplify jobs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}