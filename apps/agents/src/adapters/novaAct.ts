// agents/src/adapters/novaAct.ts
//
// Nova Act adapter for AI Hire AI 
// - Supports BOTH stub mode and real AWS Nova Act mode
// - Real mode uses @aws-sdk/client-nova-act
//
// Environment variables:
//   AWS_REGION=us-east-1
//   NOVA_ACT_WORKFLOW_NAME=aihireai-act
//   NOVA_ACT_WORKFLOW_ARN=arn:aws:nova-act:us-east-1:101406169413:workflow-definition/aihireai-act
//   NOVA_ACT_MODEL_ID=nova-act-preview
//   USE_REAL_NOVA_ACT=true
//
// Notes:
// - Real mode creates workflow runs and polls status via GetWorkflowRun
// - Stub mode remains useful for fast UI demos and offline dev
// - This file does NOT hardcode secrets
//
// Install
//   npm install @aws-sdk/client-nova-act

export type NovaActMode = "stub" | "real";

export type RunStatus =
  | "Queued"
  | "Running"
  | "Success"
  | "Failed"
  | "NeedsApproval"
  | "Paused";

export interface NovaActConfig {
  mode?: NovaActMode;
  region?: string;
  workflowDefinitionName?: string;   // preferred for real mode
  workflowDefinitionArn?: string;    // optional, stored for reference
  modelId?: string;                  // e.g. nova-act-preview
}

export interface ActStepInput {
  step: string;
  details?: string;
  requiresApproval?: boolean;
}

export interface ActStep {
  step: string;
  details?: string;
  requiresApproval: boolean;
  status: RunStatus;
  startedAtISO?: string;
  finishedAtISO?: string;
  errorMessage?: string;
}

export interface ActRun {
  runId: string;
  workflowDefinitionArn?: string;
  workflowDefinitionName?: string;
  status: RunStatus;
  steps: ActStep[];
  startedAtISO: string;
  finishedAtISO?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  errorMessage?: string;

  // Real Nova Act fields
  provider?: "stub" | "nova-act";
  remoteStatus?: string;
  remoteWorkflowRunArn?: string;
  remoteModelId?: string;
}

export interface StartRunArgs {
  cfg?: NovaActConfig;
  input: Record<string, any>;
  stepsPreview: ActStepInput[];
  autoAdvance?: boolean;    // stub mode only
  autoApprove?: boolean;    // stub mode only
}

export interface AdvanceRunArgs {
  run: ActRun;
  approveCurrent?: boolean;
  failAtStepIndex?: number;
}

const stubRunStore = new Map<string, ActRun>();

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowISO() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneRun<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function truthy(v?: string): boolean {
  return v === "1" || v === "true" || v === "TRUE" || v === "yes" || v === "on";
}

function resolveConfig(cfg?: NovaActConfig): Required<Pick<NovaActConfig, "mode" | "region" | "workflowDefinitionName" | "workflowDefinitionArn" | "modelId">> {
  const envMode = truthy(process.env.USE_REAL_NOVA_ACT) ? "real" : "stub";
  return {
    mode: cfg?.mode ?? envMode,
    region: cfg?.region ?? process.env.AWS_REGION ?? "us-east-1",
    workflowDefinitionName:
      cfg?.workflowDefinitionName ??
      process.env.NOVA_ACT_WORKFLOW_NAME ??
      "",
    workflowDefinitionArn:
      cfg?.workflowDefinitionArn ??
      process.env.NOVA_ACT_WORKFLOW_ARN ??
      "",
    modelId:
      cfg?.modelId ??
      process.env.NOVA_ACT_MODEL_ID ??
      "nova-act-preview",
  };
}

function toRunStatusFromRemote(remote?: string): RunStatus {
  switch (remote) {
    case "RUNNING":
      return "Running";
    case "SUCCEEDED":
      return "Success";
    case "FAILED":
    case "TIMED_OUT":
      return "Failed";
    default:
      return "Running";
  }
}

function initializeSteps(
  stepsPreview: ActStepInput[],
  autoApprove: boolean
): ActStep[] {
  return stepsPreview.map((s, index) => {
    const requiresApproval = s.requiresApproval ?? false;
    let status: RunStatus = "Queued";

    if (index === 0) {
      status = requiresApproval && !autoApprove ? "NeedsApproval" : "Running";
    }

    return {
      step: s.step,
      details: s.details,
      requiresApproval,
      status,
      startedAtISO:
        index === 0 && (!requiresApproval || autoApprove) ? nowISO() : undefined,
    };
  });
}

function initializeRealSteps(stepsPreview: ActStepInput[]): ActStep[] {
  return stepsPreview.map((s, index) => ({
    step: s.step,
    details: s.details,
    requiresApproval: s.requiresApproval ?? false,
    status: index === 0 ? "Running" : "Queued",
    startedAtISO: index === 0 ? nowISO() : undefined,
  }));
}

function recomputeStubRunStatus(run: ActRun): RunStatus {
  if (run.steps.some((s) => s.status === "Failed")) return "Failed";
  if (run.steps.every((s) => s.status === "Success")) return "Success";
  if (run.steps.some((s) => s.status === "NeedsApproval")) return "NeedsApproval";
  if (run.steps.some((s) => s.status === "Running")) return "Running";
  if (run.steps.some((s) => s.status === "Paused")) return "Paused";
  if (run.steps.some((s) => s.status === "Queued")) return "Queued";
  return "Queued";
}

function markStepSuccess(step: ActStep) {
  step.status = "Success";
  step.finishedAtISO = nowISO();
}

function markStepFailed(step: ActStep, message: string) {
  step.status = "Failed";
  step.finishedAtISO = nowISO();
  step.errorMessage = message;
}

function activateNextStep(run: ActRun, fromIndex: number, autoApprove: boolean) {
  const nextIndex = fromIndex + 1;
  if (nextIndex >= run.steps.length) {
    run.status = recomputeStubRunStatus(run);
    if (run.status === "Success") {
      run.finishedAtISO = nowISO();
    }
    return;
  }

  const next = run.steps[nextIndex];
  if (next.requiresApproval && !autoApprove) {
    next.status = "NeedsApproval";
  } else {
    next.status = "Running";
    next.startedAtISO = nowISO();
  }

  run.status = recomputeStubRunStatus(run);
}

function syncStepsWithRemote(run: ActRun, remoteStatus?: string): ActRun {
  const mapped = toRunStatusFromRemote(remoteStatus);

  if (mapped === "Success") {
    run.steps = run.steps.map((s) => ({
      ...s,
      status: "Success",
      startedAtISO: s.startedAtISO ?? run.startedAtISO,
      finishedAtISO: s.finishedAtISO ?? nowISO(),
    }));
    run.status = "Success";
    run.finishedAtISO = run.finishedAtISO ?? nowISO();
    return run;
  }

  if (mapped === "Failed") {
    const runningIndex = run.steps.findIndex((s) => s.status === "Running");
    if (runningIndex >= 0) {
      run.steps[runningIndex].status = "Failed";
      run.steps[runningIndex].finishedAtISO = nowISO();
      run.steps[runningIndex].errorMessage =
        run.errorMessage ?? "Remote Nova Act run failed.";
    } else if (run.steps.length > 0) {
      run.steps[0].status = "Failed";
      run.steps[0].finishedAtISO = nowISO();
    }
    run.status = "Failed";
    run.finishedAtISO = run.finishedAtISO ?? nowISO();
    return run;
  }

  // Running
  const currentRunning = run.steps.find((s) => s.status === "Running");
  if (!currentRunning) {
    const nextQueued = run.steps.find((s) => s.status === "Queued");
    if (nextQueued) {
      nextQueued.status = "Running";
      nextQueued.startedAtISO = nextQueued.startedAtISO ?? nowISO();
    }
  }

  run.status = "Running";
  return run;
}

function makeClientToken() {
  return `aihireai-${Date.now()}-${Math.random().toString(36).slice(2, 20)}`;
}

async function createNovaActClient(region: string) {
  const mod = await import("@aws-sdk/client-nova-act");
  const client = new mod.NovaActClient({ region });
  return { mod, client };
}

// ---------------------------
// Real mode
// ---------------------------
async function startRealRun(args: StartRunArgs): Promise<ActRun> {
  const cfg = resolveConfig(args.cfg);

  if (!cfg.workflowDefinitionName) {
    throw new Error(
      "Missing workflow definition name. Set NOVA_ACT_WORKFLOW_NAME or pass cfg.workflowDefinitionName."
    );
  }

  if (!cfg.modelId) {
    throw new Error(
      "Missing model id. Set NOVA_ACT_MODEL_ID or pass cfg.modelId."
    );
  }

  const { mod, client } = await createNovaActClient(cfg.region);

  const createRes = await client.send(
    new mod.CreateWorkflowRunCommand({
      workflowDefinitionName: cfg.workflowDefinitionName,
      modelId: cfg.modelId,
      clientToken: makeClientToken(),
      clientInfo: {
        compatibilityVersion: 1,
        sdkVersion: "aihireai-local",
      },
    })
  );

  const runId = createRes.workflowRunId;
  if (!runId) {
    throw new Error("Nova Act CreateWorkflowRun returned no workflowRunId.");
  }

  const run: ActRun = {
    runId,
    workflowDefinitionArn: cfg.workflowDefinitionArn || undefined,
    workflowDefinitionName: cfg.workflowDefinitionName,
    status: toRunStatusFromRemote(createRes.status),
    steps: initializeRealSteps(args.stepsPreview),
    startedAtISO: nowISO(),
    input: args.input,
    provider: "nova-act",
    remoteStatus: createRes.status,
    remoteModelId: cfg.modelId,
  };

  return cloneRun(run);
}

async function getRealRun(args: {
  cfg?: NovaActConfig;
  run: ActRun;
}): Promise<ActRun> {
  const cfg = resolveConfig(args.cfg);

  const workflowDefinitionName =
    args.run.workflowDefinitionName || cfg.workflowDefinitionName;

  if (!workflowDefinitionName) {
    throw new Error(
      "Missing workflow definition name for GetWorkflowRun."
    );
  }

  const { mod, client } = await createNovaActClient(cfg.region);

  const res = await client.send(
    new mod.GetWorkflowRunCommand({
      workflowDefinitionName,
      workflowRunId: args.run.runId,
    })
  );

  const next = cloneRun(args.run);
  next.remoteStatus = res.status;
  next.remoteWorkflowRunArn = res.workflowRunArn;
  next.remoteModelId = res.modelId ?? next.remoteModelId;

  if (res.startedAt) {
    next.startedAtISO = new Date(res.startedAt).toISOString();
  }
  if (res.endedAt) {
    next.finishedAtISO = new Date(res.endedAt).toISOString();
  }

  next.status = toRunStatusFromRemote(res.status);
  next.output = {
    ...(next.output ?? {}),
    remote: {
      workflowRunArn: res.workflowRunArn,
      status: res.status,
      startedAt: res.startedAt,
      endedAt: res.endedAt,
      modelId: res.modelId,
    },
  };

  return syncStepsWithRemote(next, res.status);
}

// ---------------------------
// Stub mode
// ---------------------------
async function startStubRun(args: StartRunArgs): Promise<ActRun> {
  const cfg = resolveConfig(args.cfg);
  const autoAdvance = args.autoAdvance ?? true;
  const autoApprove = args.autoApprove ?? false;

  let run: ActRun = {
    runId: uid("actrun"),
    workflowDefinitionArn: cfg.workflowDefinitionArn || undefined,
    workflowDefinitionName: cfg.workflowDefinitionName || undefined,
    status: "Queued",
    steps: initializeSteps(args.stepsPreview, autoApprove),
    startedAtISO: nowISO(),
    input: args.input,
    provider: "stub",
    remoteStatus: undefined,
    remoteModelId: cfg.modelId || undefined,
  };

  run.status = recomputeStubRunStatus(run);

  if (autoAdvance) {
    run = await advanceStubRun({
      run,
      approveCurrent: autoApprove,
    });
  }

  stubRunStore.set(run.runId, cloneRun(run));
  return cloneRun(run);
}

async function getStubRun(runId: string): Promise<ActRun> {
  const found = stubRunStore.get(runId);
  if (!found) {
    throw new Error(`Stub run not found: ${runId}`);
  }
  return cloneRun(found);
}

async function advanceStubRun(args: AdvanceRunArgs): Promise<ActRun> {
  let run = cloneRun(args.run);

  if (run.status === "Success" || run.status === "Failed") {
    stubRunStore.set(run.runId, cloneRun(run));
    return run;
  }

  let activeIndex = run.steps.findIndex(
    (s) => s.status === "Running" || s.status === "NeedsApproval"
  );

  if (activeIndex === -1) {
    const queuedIndex = run.steps.findIndex((s) => s.status === "Queued");
    if (queuedIndex !== -1) {
      const q = run.steps[queuedIndex];
      if (q.requiresApproval) {
        q.status = "NeedsApproval";
      } else {
        q.status = "Running";
        q.startedAtISO = nowISO();
      }
      activeIndex = queuedIndex;
    }
  }

  if (activeIndex === -1) {
    run.status = recomputeStubRunStatus(run);
    if (run.status === "Success") {
      run.finishedAtISO = run.finishedAtISO ?? nowISO();
    }
    stubRunStore.set(run.runId, cloneRun(run));
    return run;
  }

  const step = run.steps[activeIndex];

  if (step.status === "NeedsApproval") {
    if (!args.approveCurrent) {
      run.status = "NeedsApproval";
      stubRunStore.set(run.runId, cloneRun(run));
      return run;
    }

    step.status = "Running";
    step.startedAtISO = step.startedAtISO ?? nowISO();
    run.status = "Running";
  }

  if (step.status === "Running") {
    if (
      args.failAtStepIndex !== undefined &&
      args.failAtStepIndex === activeIndex
    ) {
      markStepFailed(step, "Simulated step failure for demo/testing.");
      run.status = "Failed";
      run.finishedAtISO = nowISO();
      run.errorMessage = step.errorMessage;
      stubRunStore.set(run.runId, cloneRun(run));
      return run;
    }

    markStepSuccess(step);
    activateNextStep(run, activeIndex, false);
  }

  run.status = recomputeStubRunStatus(run);

  if (run.status === "Success") {
    run.finishedAtISO = run.finishedAtISO ?? nowISO();
    run.output = {
      message: "Nova Act stub run completed successfully.",
      completedSteps: run.steps.length,
      runType: run.input?.kind ?? run.input?.type ?? "generic_action_run",
    };
  }

  stubRunStore.set(run.runId, cloneRun(run));
  return run;
}

// ---------------------------
// Public API
// ---------------------------
export async function novaActStartRun(args: StartRunArgs): Promise<ActRun> {
  const cfg = resolveConfig(args.cfg);

  if (cfg.mode === "real") {
    return startRealRun(args);
  }

  return startStubRun(args);
}

export async function novaActGetRun(args: {
  cfg?: NovaActConfig;
  runId: string;
  run?: ActRun;
}): Promise<ActRun> {
  const cfg = resolveConfig(args.cfg);

  if (cfg.mode === "real") {
    const baseRun: ActRun =
      args.run ??
      ({
        runId: args.runId,
        workflowDefinitionArn: cfg.workflowDefinitionArn || undefined,
        workflowDefinitionName: cfg.workflowDefinitionName || undefined,
        status: "Running",
        steps: [],
        startedAtISO: nowISO(),
        provider: "nova-act",
      } as ActRun);

    return getRealRun({ cfg, run: baseRun });
  }

  return getStubRun(args.runId);
}

export async function novaActAdvanceRun(args: AdvanceRunArgs): Promise<ActRun> {
  const isReal = args.run.provider === "nova-act";

  if (isReal) {
    // For real mode, "advance" means poll remote state again.
    return novaActGetRun({
      runId: args.run.runId,
      run: args.run,
      cfg: {
        mode: "real",
        workflowDefinitionArn: args.run.workflowDefinitionArn,
        workflowDefinitionName: args.run.workflowDefinitionName,
      },
    });
  }

  return advanceStubRun(args);
}

export async function novaActRunToCompletion(args: StartRunArgs & {
  maxPolls?: number;
  pollIntervalMs?: number;
}): Promise<ActRun> {
  const cfg = resolveConfig(args.cfg);

  if (cfg.mode === "real") {
    let run = await startRealRun(args);
    const maxPolls = args.maxPolls ?? 20;
    const pollIntervalMs = args.pollIntervalMs ?? 1500;

    for (let i = 0; i < maxPolls; i++) {
      if (run.status === "Success" || run.status === "Failed") {
        return run;
      }

      await sleep(pollIntervalMs);

      run = await getRealRun({
        cfg,
        run,
      });
    }

    return run; // may still be Running, and that's okay for demo UI
  }

  let run = await startStubRun({
    ...args,
    autoAdvance: false,
  });

  while (run.status !== "Success" && run.status !== "Failed") {
    const needsApproval = run.steps.some((s) => s.status === "NeedsApproval");
    run = await advanceStubRun({
      run,
      approveCurrent: needsApproval ? true : false,
    });
  }

  stubRunStore.set(run.runId, cloneRun(run));
  return cloneRun(run);
}

export function novaActResetStubStore() {
  stubRunStore.clear();
}