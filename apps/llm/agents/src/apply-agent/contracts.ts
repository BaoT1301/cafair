import type {
  ApplyAgentExecutionStep,
  ApplyAgentRunInput,
  ApplyAgentRunOutput,
  ApplyAgentVisibleField,
} from "./types";

export type ApplyAgentPythonRequest = {
  runId: string;
  targetUrl: string;
  provider: "greenhouse" | "workday" | "ashby" | "unknown";
  mode: "demo" | "plan" | "live";
  shouldApply: boolean;
  safeStopBeforeSubmit: boolean;
  company?: string | null;
  roleTitle?: string | null;
  selectors: string[];
  plannedSteps: string[];
};

export type ApplyAgentPythonResponse = {
  ok: boolean;
  runId: string;
  provider: "greenhouse" | "workday" | "ashby" | "unknown";
  mode: "demo" | "plan" | "live";
  status: "planned" | "queued" | "running" | "completed" | "failed";
  executed: boolean;
  safeStopBeforeSubmit: boolean;
  visibleFields: ApplyAgentVisibleField[];
  executionSteps: ApplyAgentExecutionStep[];
  message: string;
};

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
    selectors: input.selectors,
    plannedSteps: input.plannedSteps,
  };
}

export function fromPythonResponse(
  response: ApplyAgentPythonResponse,
): ApplyAgentRunOutput {
  return {
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
}
