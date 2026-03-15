import { NextResponse } from "next/server";
import {
  getSocialScreenRunStatus,
  resolveSocialScreenRunAlias,
} from "@/server/aihire/social-screen-run-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runIdParam = url.searchParams.get("runId")?.trim();
  const candidate = url.searchParams.get("candidate")?.trim() ?? undefined;

  if (!runIdParam) {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: runId" },
      { status: 400 },
    );
  }

  const resolved = resolveSocialScreenRunAlias(runIdParam, candidate);
  if (!resolved.runId) {
    return NextResponse.json(
      { ok: false, error: resolved.error ?? "Run not found", candidate },
      { status: 404 },
    );
  }

  const status = getSocialScreenRunStatus(resolved.runId);
  if (!status) {
    return NextResponse.json(
      { ok: false, error: "Run not found", candidate },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    ...status,
  });
}
