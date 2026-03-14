import { NextResponse } from "next/server";
import {
  getSocialScreenRunManifest,
  loadSocialScreenRunReport,
  resolveSocialScreenRunAlias,
} from "@/server/aihire/social-screen-run-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runIdParam = url.searchParams.get("runId")?.trim();
  const candidate = url.searchParams.get("candidate")?.trim() ?? undefined;

  if (!runIdParam) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing required query param: runId",
      },
      { status: 400 },
    );
  }

  const resolved = resolveSocialScreenRunAlias(runIdParam, candidate);
  if (!resolved.runId) {
    return NextResponse.json(
      {
        ok: false,
        error: resolved.error ?? "Run not found",
        candidate,
      },
      { status: 404 },
    );
  }
  const runId = resolved.runId;

  const manifest = getSocialScreenRunManifest(runId);
  if (!manifest) {
    return NextResponse.json(
      {
        ok: false,
        error: "Run not found",
        candidate,
      },
      { status: 404 },
    );
  }

  const report = loadSocialScreenRunReport(runId);
  if (!report) {
    return NextResponse.json(
      {
        ok: false,
        status: manifest.status,
        runId,
      },
      { status: manifest.status === "failed" ? 500 : 202 },
    );
  }

  return NextResponse.json({
    ok: true,
    report,
    runId,
    status: manifest.status,
  });
}
