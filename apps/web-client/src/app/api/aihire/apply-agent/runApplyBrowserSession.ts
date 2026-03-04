// Path: apps/web-client/src/app/api/aihire/apply-agent/runApplyBrowserSession.ts

import { runNovaActApplyPlan } from "@/lib/aihire/apply-agent/novaActApplyRunner";
import type {
  ApplyExecutionPlan,
  ApplicationProvider,
} from "@/lib/aihire/apply-agent/applyAgentTypes";

export type ApplyBrowserSessionMode = "demo" | "plan" | "live";

export type RunApplyBrowserSessionInput = {
  runId: string;
  targetUrl: string;
  provider: ApplicationProvider;
  company?: string | null;
  roleTitle?: string | null;
  mode: ApplyBrowserSessionMode;
  shouldApply: boolean;
  plan: ApplyExecutionPlan;
};

export type RunApplyBrowserSessionResult = {
  ok: boolean;
  runId: string;
  provider: ApplicationProvider;
  mode: ApplyBrowserSessionMode;
  status: "planned" | "queued" | "running" | "completed" | "failed";
  safeStopBeforeSubmit: boolean;
  executed: boolean;
  executionSteps: string[];
  message: string;
  runner: {
    type: "stub";
    engine: "nova-act";
    transport: "local-python-bridge";
  };
};

export async function runApplyBrowserSession(
  input: RunApplyBrowserSessionInput,
): Promise<RunApplyBrowserSessionResult> {
  const result = await runNovaActApplyPlan({
    runId: input.runId,
    targetUrl: input.targetUrl,
    provider: input.provider,
    company: input.company,
    roleTitle: input.roleTitle,
    mode: input.mode,
    shouldApply: input.shouldApply,
    plan: input.plan,
  });

  return {
    ok: result.ok,
    runId: result.runId,
    provider: result.provider,
    mode: result.mode,
    status: result.status,
    safeStopBeforeSubmit: result.safeStopBeforeSubmit,
    executed: result.executed,
    executionSteps: result.executionSteps,
    message: result.message,
    runner: result.runner,
  };
}