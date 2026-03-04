import { NextResponse } from "next/server";
import { addApplyAgentHistoryItem } from "@/app/api/aihire/apply-agent/history/route";
import { detectApplicationProvider } from "@/lib/aihire/apply-agent/detectApplicationProvider";
import { buildApplyExecutionPlan } from "@/lib/aihire/apply-agent/buildApplyExecutionPlan";
import { runNovaActApplyPlan } from "@/lib/aihire/apply-agent/novaActApplyRunner";

type ApplyAgentRunRequest = {
  targetUrl: string;
  company?: string;
  roleTitle?: string;
  matchedKeywordCount?: number;
  autoApply?: boolean;
  threshold?: number;
  mode?: "demo" | "plan" | "live";
};

type ApplyAgentRunResponse = {
  ok: boolean;
  runId?: string;
  status?: "queued" | "planned" | "running" | "completed" | "failed";
  mode?: "demo" | "plan" | "live";
  provider?: "greenhouse" | "workday" | "ashby" | "unknown";
  targetUrl?: string;
  company?: string | null;
  roleTitle?: string | null;
  matchedKeywordCount?: number | null;
  threshold?: number;
  shouldApply?: boolean;
  plan?: {
    provider: "greenhouse" | "workday" | "ashby" | "unknown";
    safeStopBeforeSubmit: boolean;
    selectors: string[];
    steps: string[];
  };
  safeStopBeforeSubmit?: boolean;
  executed?: boolean;
  executionSteps?: string[];
  runner?: {
    type: "stub";
    engine: "nova-act";
    transport: "local-python-bridge";
  };
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

function normalizeMode(
  value: ApplyAgentRunRequest["mode"],
): "demo" | "plan" | "live" {
  if (value === "live") return "live";
  if (value === "plan") return "plan";
  return "demo";
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

    const company =
      typeof body.company === "string" && body.company.trim()
        ? body.company.trim()
        : null;

    const roleTitle =
      typeof body.roleTitle === "string" && body.roleTitle.trim()
        ? body.roleTitle.trim()
        : null;

    const matchedKeywordCount =
      typeof body.matchedKeywordCount === "number"
        ? Math.max(0, Math.floor(body.matchedKeywordCount))
        : null;

    const threshold =
      typeof body.threshold === "number" && body.threshold > 0
        ? Math.floor(body.threshold)
        : 3;

    const shouldApply =
      typeof body.autoApply === "boolean"
        ? body.autoApply
        : (matchedKeywordCount ?? 0) >= threshold;

    const mode = normalizeMode(body.mode);
    const provider = detectApplicationProvider(targetUrl);

    const plan = buildApplyExecutionPlan({
      targetUrl,
      provider,
      company,
      roleTitle,
      shouldApply,
      mode,
    });

    const runId = makeRunId();

    const runnerResult = await runNovaActApplyPlan({
      runId,
      targetUrl,
      provider,
      company,
      roleTitle,
      mode,
      shouldApply,
      plan,
    });

    const historyStatus =
      runnerResult.status === "planned" ? "queued" : runnerResult.status;

    addApplyAgentHistoryItem({
      mode: "run",
      status: historyStatus,
      summary: shouldApply
        ? `Prepared ${provider} apply-agent ${mode} run ` +
          `for ${roleTitle || "target role"} ` +
          `at ${company || "target company"}.`
        : `Skipped apply-agent run because the job did not meet the threshold.`,
      targetUrl,
      company: company ?? undefined,
      roleTitle: roleTitle ?? undefined,
      matchedKeywordCount: matchedKeywordCount ?? undefined,
    });

    return NextResponse.json<ApplyAgentRunResponse>(
      {
        ok: true,
        runId: runnerResult.runId,
        status: runnerResult.status,
        mode: runnerResult.mode,
        provider: runnerResult.provider,
        targetUrl,
        company,
        roleTitle,
        matchedKeywordCount,
        threshold,
        shouldApply,
        plan,
        safeStopBeforeSubmit: runnerResult.safeStopBeforeSubmit,
        executed: runnerResult.executed,
        executionSteps: runnerResult.executionSteps,
        runner: runnerResult.runner,
        message: runnerResult.message,
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