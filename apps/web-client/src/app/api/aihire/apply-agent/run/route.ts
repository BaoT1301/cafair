// Path: apps/web-client/src/app/api/aihire/apply-agent/run/route.ts

import { NextResponse } from "next/server";
import { addApplyAgentHistoryItem } from "@/app/api/aihire/apply-agent/history/route";

type ApplyAgentRunRequest = {
  targetUrl: string;
  company?: string;
  roleTitle?: string;
  matchedKeywordCount?: number;
  autoApply?: boolean;
};

type ApplyAgentRunResponse = {
  ok: boolean;
  runId?: string;
  status?: "queued" | "running" | "completed" | "failed";
  mode?: "demo" | "live";
  targetUrl?: string;
  company?: string | null;
  roleTitle?: string | null;
  matchedKeywordCount?: number | null;
  shouldApply?: boolean;
  steps?: string[];
  message?: string;
  error?: string;
  details?: string;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function makeRunId(): string {
  return `aar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ApplyAgentRunRequest;

    if (!body?.targetUrl || typeof body.targetUrl !== "string") {
      return NextResponse.json<ApplyAgentRunResponse>(
        {
          ok: false,
          error: "targetUrl is required and must be a string.",
        },
        { status: 400 },
      );
    }

    const targetUrl = body.targetUrl.trim();

    if (!isValidHttpUrl(targetUrl)) {
      return NextResponse.json<ApplyAgentRunResponse>(
        {
          ok: false,
          error: "targetUrl must be a valid http or https URL.",
        },
        { status: 400 },
      );
    }

    const matchedKeywordCount =
      typeof body.matchedKeywordCount === "number"
        ? body.matchedKeywordCount
        : null;

    const shouldApply =
      typeof body.autoApply === "boolean"
        ? body.autoApply
        : (matchedKeywordCount ?? 0) > 3;

    const runId = makeRunId();

    const steps: string[] = [
      "Open the target job application page.",
      "Wait for the page to stabilize and identify the primary Apply button.",
      "Capture visible fields and determine whether sign-in is required.",
      "Check that the job still appears open and eligible.",
    ];

    if (shouldApply) {
      steps.push(
        "Proceed with demo auto-apply flow because the match threshold passed.",
        "Prefill candidate details from the saved resume/profile source.",
        "Review required fields, validate missing inputs, and prepare submission.",
        "Pause before final submit in demo mode unless live execution is explicitly enabled.",
      );
    } else {
      steps.push(
        "Stop before application because the match threshold did not pass.",
        "Return a recommendation to skip this role for now.",
      );
    }

    addApplyAgentHistoryItem({
      mode: "run",
      status: shouldApply ? "queued" : "completed",
      summary: shouldApply
        ? `Prepared apply-agent run for ${body.roleTitle?.trim() || "target role"} at ${body.company?.trim() || "target company"}.`
        : `Skipped apply-agent run because the job did not meet the keyword threshold.`,
      targetUrl,
      company:
        typeof body.company === "string" && body.company.trim()
          ? body.company.trim()
          : undefined,
      roleTitle:
        typeof body.roleTitle === "string" && body.roleTitle.trim()
          ? body.roleTitle.trim()
          : undefined,
      matchedKeywordCount: matchedKeywordCount ?? undefined,
    });

    return NextResponse.json<ApplyAgentRunResponse>(
      {
        ok: true,
        runId,
        status: shouldApply ? "queued" : "completed",
        mode: "demo",
        targetUrl,
        company:
          typeof body.company === "string" && body.company.trim()
            ? body.company.trim()
            : null,
        roleTitle:
          typeof body.roleTitle === "string" && body.roleTitle.trim()
            ? body.roleTitle.trim()
            : null,
        matchedKeywordCount,
        shouldApply,
        steps,
        message: shouldApply
          ? "Apply-agent demo run is ready. Threshold passed, so this role is eligible for auto-apply flow."
          : "Apply-agent demo run stopped. Threshold did not pass, so this role is not eligible for auto-apply flow.",
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json<ApplyAgentRunResponse>(
      {
        ok: false,
        error: "Failed to start apply-agent run",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}