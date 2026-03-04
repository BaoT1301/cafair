// Path: apps/web-client/src/lib/aihire/apply-agent/novaActApplyRunner.ts

import type {
  ApplyExecutionPlan,
  ApplicationProvider,
} from "@/lib/aihire/apply-agent/applyAgentTypes";

export type NovaActRunnerMode = "demo" | "plan" | "live";

export type NovaActRunnerInput = {
  runId: string;
  targetUrl: string;
  provider: ApplicationProvider;
  company?: string | null;
  roleTitle?: string | null;
  mode: NovaActRunnerMode;
  shouldApply: boolean;
  plan: ApplyExecutionPlan;
};

export type NovaActRunnerResult = {
  ok: boolean;
  runId: string;
  provider: ApplicationProvider;
  mode: NovaActRunnerMode;
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

function buildExecutionSteps(input: NovaActRunnerInput): string[] {
  const baseSteps: string[] = [
    `Initialize Nova Act runner for ${input.provider}.`,
    `Prepare browser session for ${input.targetUrl}.`,
    "Load provider-specific selectors and action plan.",
  ];

  if (!input.shouldApply) {
    return [
      ...baseSteps,
      "Stop execution because this role did not pass the apply threshold.",
      "Return a skip result without launching form automation.",
    ];
  }

  if (input.mode === "plan") {
    return [
      ...baseSteps,
      "Do not launch a live browser session.",
      "Return the provider-specific execution plan only.",
    ];
  }

  if (input.mode === "demo") {
    return [
      ...baseSteps,
      "Simulate browser actions using the saved plan.",
      "Pretend to open the job page and identify the Apply button.",
      "Pretend to prefill saved candidate fields.",
      "Stop before final submit because safe mode is enabled.",
    ];
  }

  return [
    ...baseSteps,
    "Launch a real browser runner through the Python bridge.",
    "Navigate to the target job page.",
    "Execute provider-specific apply steps.",
    "Prefill saved candidate fields.",
    "Stop before final submit because safe mode is enabled.",
  ];
}

function resolveStatus(
  input: NovaActRunnerInput,
): NovaActRunnerResult["status"] {
  if (!input.shouldApply) {
    return "completed";
  }

  if (input.mode === "plan") {
    return "planned";
  }

  if (input.mode === "demo") {
    return "queued";
  }

  return "running";
}

function buildMessage(input: NovaActRunnerInput): string {
  if (!input.shouldApply) {
    return "Nova Act runner skipped execution because the role did not meet the apply threshold.";
  }

  if (input.mode === "plan") {
    return "Nova Act runner prepared an execution plan only. No live browser session was started.";
  }

  if (input.mode === "demo") {
    return "Nova Act runner prepared a demo execution. Browser actions are still simulated.";
  }

  return "Nova Act runner is prepared for live execution through the Python bridge, with safety stop enabled before final submit.";
}

export async function runNovaActApplyPlan(
  input: NovaActRunnerInput,
): Promise<NovaActRunnerResult> {
  const executionSteps = buildExecutionSteps(input);
  const status = resolveStatus(input);

  return {
    ok: true,
    runId: input.runId,
    provider: input.provider,
    mode: input.mode,
    status,
    safeStopBeforeSubmit: input.plan.safeStopBeforeSubmit,
    executed: input.mode === "live" && input.shouldApply,
    executionSteps,
    message: buildMessage(input),
    runner: {
      type: "stub",
      engine: "nova-act",
      transport: "local-python-bridge",
    },
  };
}