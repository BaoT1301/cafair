// Path: apps/web-client/src/lib/aihire/apply-agent/applyAgentTypes.ts

export type ApplicationProvider =
  | "greenhouse"
  | "workday"
  | "ashby"
  | "unknown";

export type ApplyExecutionPlan = {
  provider: ApplicationProvider;
  safeStopBeforeSubmit: boolean;
  selectors: string[];
  steps: string[];
};