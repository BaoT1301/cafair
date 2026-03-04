import type {
  ApplyAgentExecutionStep,
  ApplyAgentRunInput,
  ApplyAgentRunOutput,
  ApplyAgentVisibleField,
} from "./types";

export type ApplyAgentProvider =
  | "greenhouse"
  | "workday"
  | "ashby"
  | "unknown";

export type ApplyAgentRunMode = "demo" | "plan" | "live";

export type ApplyAgentRunStatus =
  | "planned"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type ApplyAgentTransport = "workflow" | "api";

export type ApplyAgentPythonRunnerMetadata = {
  engine: "nova-act";
  transport: ApplyAgentTransport;
  adapter: string;
  provider: ApplyAgentProvider;
};

export type ApplyAgentPythonRequest = {
  runId: string;
  targetUrl: string;
  provider: ApplyAgentProvider;
  mode: ApplyAgentRunMode;
  shouldApply: boolean;
  safeStopBeforeSubmit: boolean;
  company?: string | null;
  roleTitle?: string | null;
  selectors: string[];
  plannedSteps: string[];
  transport?: ApplyAgentTransport;
};

export type ApplyAgentPythonResponse = {
  ok: boolean;
  runId: string;
  provider: ApplyAgentProvider;
  mode: ApplyAgentRunMode;
  status: ApplyAgentRunStatus;
  executed: boolean;
  safeStopBeforeSubmit: boolean;
  visibleFields: ApplyAgentVisibleField[];
  executionSteps: ApplyAgentExecutionStep[];
  message: string;
  runner?: ApplyAgentPythonRunnerMetadata;
  targetUrl?: string;
  company?: string | null;
  roleTitle?: string | null;
  selectors?: string[];
  plannedSteps?: string[];
};

function normalizeTransport(
  value: unknown,
): ApplyAgentTransport | undefined {
  if (value === "api") {
    return "api";
  }

  if (value === "workflow") {
    return "workflow";
  }

  return undefined;
}

export function toPythonRequest(
  input: ApplyAgentRunInput,
): ApplyAgentPythonRequest {
  return {
    runId: input.runId,
    targetUrl: input.targetUrl,
    provider: input.provider,
    mode: input.mode,
    shouldApply: input.shouldApply,
    safeStopBeforeSubmit: input.safeStopBeforeSubmit,
    company: input.company ?? null,
    roleTitle: input.roleTitle ?? null,
    selectors: [...input.selectors],
    plannedSteps: [...input.plannedSteps],
    transport: normalizeTransport(
      (input as ApplyAgentRunInput & { transport?: unknown }).transport,
    ),
  };
}

export function fromPythonResponse(
  response: ApplyAgentPythonResponse,
): ApplyAgentRunOutput {
  const baseOutput: ApplyAgentRunOutput = {
    ok: response.ok,
    runId: response.runId,
    provider: response.provider,
    mode: response.mode,
    status: response.status,
    executed: response.executed,
    safeStopBeforeSubmit: response.safeStopBeforeSubmit,
    visibleFields: response.visibleFields,
    executionSteps: response.executionSteps,
    message: response.message,
  };

  const extendedOutput = baseOutput as ApplyAgentRunOutput & {
    runner?: ApplyAgentPythonRunnerMetadata;
    targetUrl?: string;
    company?: string | null;
    roleTitle?: string | null;
    selectors?: string[];
    plannedSteps?: string[];
  };

  if (response.runner) {
    extendedOutput.runner = response.runner;
  }

  if (typeof response.targetUrl === "string") {
    extendedOutput.targetUrl = response.targetUrl;
  }

  if (response.company !== undefined) {
    extendedOutput.company = response.company;
  }

  if (response.roleTitle !== undefined) {
    extendedOutput.roleTitle = response.roleTitle;
  }

  if (Array.isArray(response.selectors)) {
    extendedOutput.selectors = [...response.selectors];
  }

  if (Array.isArray(response.plannedSteps)) {
    extendedOutput.plannedSteps = [...response.plannedSteps];
  }

  return extendedOutput;
}
