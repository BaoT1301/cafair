export type ApplyAgentProvider =
  | "greenhouse"
  | "workday"
  | "ashby"
  | "unknown";

export type ApplyAgentMode = "demo" | "plan" | "live";

export type ApplyAgentFieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "file"
  | "unknown";

export type ApplyAgentVisibleField = {
  name: string;
  label: string;
  type: ApplyAgentFieldType;
  required: boolean;
  selector?: string;
};

export type ApplyAgentExecutionStep = {
  id: string;
  action: string;
  detail: string;
};

export type ApplyAgentRunInput = {
  runId: string;
  targetUrl: string;
  provider: ApplyAgentProvider;
  company?: string | null;
  roleTitle?: string | null;
  mode: ApplyAgentMode;
  shouldApply: boolean;
  safeStopBeforeSubmit: boolean;
  selectors: string[];
  plannedSteps: string[];
};

export type ApplyAgentRunOutput = {
  ok: boolean;
  runId: string;
  provider: ApplyAgentProvider;
  mode: ApplyAgentMode;
  status: "planned" | "queued" | "running" | "completed" | "failed";
  executed: boolean;
  safeStopBeforeSubmit: boolean;
  visibleFields: ApplyAgentVisibleField[];
  executionSteps: ApplyAgentExecutionStep[];
  message: string;
};