// Path: apps/llm/agents/src/agents/atsPayload.ts
//
// ATS payload adapter (demo-ready, recruiter-side).
// Converts triage + verify + microscreen outputs into an ATS-ready payload:
// - stage suggestion
// - tags
// - structured note
// - follow-up tasks
// - email drafts
// - Nova Act preview steps
//
// Works well with:
// - buildCandidatePacket(...)
// - novaActStartRun(...)

import type { Lane, TriageResult, MicroScreenResult } from "../types";
import type { VerifyResult, VerifyAction } from "./verify";

export type AtsStage =
  | "NEW"
  | "SCREEN"
  | "INTERVIEW"
  | "OFFER"
  | "HOLD"
  | "REJECT";

export type AtsTaskType =
  | "FOLLOW_UP"
  | "SCHEDULE_INTERVIEW"
  | "SEND_MICRO_SCREEN"
  | "SEND_CODING_SCREEN"
  | "REQUEST_LINKEDIN"
  | "REQUEST_PORTFOLIO"
  | "REQUEST_CLARIFICATION"
  | "REVIEW_FLAG";

export interface AtsTask {
  type: AtsTaskType;
  label: string;
  priority: "Low" | "Medium" | "High";
  meta?: Record<string, string | number | boolean>;
}

export interface AtsEmailDraft {
  kind: "THANK_YOU" | "NEXT_STEPS" | "REDIRECT";
  subject: string;
  body: string;
}

export interface NovaActStepPreview {
  step: string;
  details?: string;
  status?: "Queued" | "Running" | "Success" | "Failed";
  requiresApproval?: boolean;
}

export interface AtsUpdatePayload {
  candidateId: string;
  roleId: string;

  stage: AtsStage;
  tags: string[];

  note: string;
  tasks: AtsTask[];

  emailDrafts: AtsEmailDraft[];
  actPreviewSteps: NovaActStepPreview[];

  summary: string;

  debug?: {
    lane: Lane;
    fitScore: number;
    riskScore: number;
    microscreenOverall?: number;
    flagCount: number;
  };
}

export interface CandidatePacketLike {
  candidateId: string;
  roleId: string;
  candidateName?: string;
  companyName?: string;
  roleName?: string;

  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
}

function clip01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function pct(x: number): string {
  return `${Math.round(clip01(x) * 100)}%`;
}

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function laneLabel(lane: Lane): string {
  if (lane === "RECRUITER_NOW") return "Recruiter Now";
  if (lane === "QUICK_ASYNC_SCREEN") return "Quick Screen";
  return "Redirect";
}

function severityToPriority(severity: string): "Low" | "Medium" | "High" {
  if (severity === "HIGH") return "High";
  if (severity === "MEDIUM") return "Medium";
  return "Low";
}

function mapStage(args: {
  lane: Lane;
  riskScore: number;
  microscreenOverall?: number;
}): AtsStage {
  const { lane, riskScore, microscreenOverall } = args;

  if (riskScore >= 0.65) return "HOLD";

  if (lane === "RECRUITER_NOW") {
    if (microscreenOverall !== undefined && microscreenOverall < 3.0) {
      return "SCREEN";
    }
    return "INTERVIEW";
  }

  if (lane === "QUICK_ASYNC_SCREEN") return "SCREEN";

  return "HOLD";
}

function extractSkillTags(triage: TriageResult): string[] {
  const fromEvidence = (triage.evidence ?? [])
    .map((e) => e.keyword)
    .filter((k): k is string => !!k)
    .slice(0, 8)
    .map((k) => `skill:${k.toLowerCase()}`);

  return uniq(fromEvidence);
}

function mapVerifyActionToTask(action: VerifyAction["action"]): AtsTask | null {
  switch (action) {
    case "REQUEST_LINKEDIN":
      return {
        type: "REQUEST_LINKEDIN",
        label: "Request LinkedIn profile",
        priority: "Medium",
        meta: { source: "verify" },
      };

    case "REQUEST_PORTFOLIO":
      return {
        type: "REQUEST_PORTFOLIO",
        label: "Request portfolio or GitHub link",
        priority: "Medium",
        meta: { source: "verify" },
      };

    case "SEND_CODE_SCREEN":
      return {
        type: "SEND_CODING_SCREEN",
        label: "Send quick coding screen",
        priority: "High",
        meta: { source: "verify" },
      };

    case "ASK_FOLLOWUP":
      return {
        type: "REQUEST_CLARIFICATION",
        label: "Ask short clarification question",
        priority: "High",
        meta: { source: "verify" },
      };

    case "REQUEST_TRANSCRIPT_EXPORT":
      return {
        type: "REVIEW_FLAG",
        label: "Export transcript for recruiter review",
        priority: "Medium",
        meta: { source: "verify" },
      };

    default:
      return null;
  }
}

function buildTags(packet: CandidatePacketLike, stage: AtsStage): string[] {
  const riskTag =
    packet.verify.riskScore >= 0.65
      ? "risk:high"
      : packet.verify.riskScore >= 0.35
        ? "risk:medium"
        : "risk:low";

  const stageTag = `stage:${stage.toLowerCase()}`;
  const laneTag = `lane:${packet.triage.lane.toLowerCase()}`;
  const fitTag = `fit:${Math.round(packet.triage.fitScore * 100)}`;
  const sourceTag = "source:career_fair";
  const flagTag = `flags:${packet.verify.flags.length}`;

  return uniq([
    sourceTag,
    stageTag,
    laneTag,
    fitTag,
    riskTag,
    flagTag,
    ...extractSkillTags(packet.triage),
  ]);
}

function buildTasks(packet: CandidatePacketLike, stage: AtsStage): AtsTask[] {
  const tasks: AtsTask[] = [];

  if (stage === "INTERVIEW") {
    tasks.push({
      type: "SCHEDULE_INTERVIEW",
      label: "Schedule interview",
      priority: "High",
    });
    tasks.push({
      type: "FOLLOW_UP",
      label: "Send next-step follow-up",
      priority: "High",
    });
  } else if (stage === "SCREEN") {
    tasks.push({
      type: "SEND_MICRO_SCREEN",
      label: "Send 3-minute micro-screen",
      priority: "High",
    });
  } else if (stage === "HOLD") {
    tasks.push({
      type: "REVIEW_FLAG",
      label: "Review verification signals before advancing",
      priority: "High",
    });
  }

  for (const suggested of packet.verify.suggestedActions.slice(0, 3)) {
    const task = mapVerifyActionToTask(suggested.action);
    if (task) tasks.push(task);
  }

  for (const flag of packet.verify.flags.slice(0, 2)) {
    tasks.push({
      type: "REVIEW_FLAG",
      label: `Review flag: ${flag.type}`,
      priority: severityToPriority(flag.severity),
      meta: { severity: flag.severity, type: flag.type },
    });
  }

  return tasks.slice(0, 8);
}

function buildTopEvidence(packet: CandidatePacketLike): string[] {
  const lines: string[] = [];

  for (const e of (packet.triage.evidence ?? []).slice(0, 4)) {
    const pieces: string[] = [];
    if (e.label) pieces.push(e.label);
    if (e.keyword) pieces.push(`keyword=${e.keyword}`);
    if (e.quote) pieces.push(`quote="${e.quote}"`);
    lines.push(`- ${pieces.join(" | ")}`);
  }

  if (packet.microscreen?.highlights?.length) {
    for (const h of packet.microscreen.highlights.slice(0, 2)) {
      lines.push(`- micro-screen: "${h}"`);
    }
  }

  if (!lines.length) lines.push("- no strong evidence extracted");
  return lines;
}

function buildFlagLines(packet: CandidatePacketLike): string[] {
  const lines = packet.verify.flags.slice(0, 3).map((f) => {
    return `- ${f.type} (${f.severity}): ${f.reason}`;
  });

  if (!lines.length) lines.push("- none");
  return lines;
}

function buildStructuredNote(packet: CandidatePacketLike, stage: AtsStage): string {
  const header = [
    "AI Hire AI — ATS Sync Note",
    packet.candidateName ? `Candidate: ${packet.candidateName}` : "",
    packet.roleName ? `Role: ${packet.roleName}` : "",
    packet.companyName ? `Company: ${packet.companyName}` : "",
  ].filter(Boolean);

  const summaryLines = [
    `Lane: ${laneLabel(packet.triage.lane)}`,
    `Fit: ${pct(packet.triage.fitScore)}`,
    `Confidence: ${pct(packet.triage.confidence)}`,
    `Verification Risk: ${pct(packet.verify.riskScore)}`,
    `Suggested Stage: ${stage}`,
    packet.microscreen
      ? `Micro-screen: ${packet.microscreen.overall.toFixed(2)}/5 (confidence ${packet.microscreen.confidence.toFixed(2)})`
      : "Micro-screen: not available",
  ];

  const evidenceLines = buildTopEvidence(packet);
  const flagLines = buildFlagLines(packet);

  const recommendedNext =
    stage === "INTERVIEW"
      ? "Move candidate to interview scheduling."
      : stage === "SCREEN"
        ? "Request quick screen before recruiter time."
        : "Hold candidate until clarification or proof is reviewed.";

  return [
    ...header,
    "",
    ...summaryLines,
    "",
    "Top Evidence:",
    ...evidenceLines,
    "",
    "Verification Signals:",
    ...flagLines,
    "",
    `Recommended Next Step: ${recommendedNext}`,
  ].join("\n");
}

function buildEmailDrafts(packet: CandidatePacketLike, stage: AtsStage): AtsEmailDraft[] {
  const name = packet.candidateName ?? "there";
  const role = packet.roleName ?? "this role";

  if (stage === "INTERVIEW") {
    return [
      {
        kind: "NEXT_STEPS",
        subject: `Next steps for ${role}`,
        body:
          `Hi ${name},\n\n` +
          `Thanks for speaking with us today. We’d like to move you forward for ${role}. ` +
          `Please send 2–3 time windows that work for a short interview this week.\n\n` +
          `Best,\nRecruiting Team`,
      },
    ];
  }

  if (stage === "SCREEN") {
    return [
      {
        kind: "THANK_YOU",
        subject: `Thanks for your interest in ${role}`,
        body:
          `Hi ${name},\n\n` +
          `Thanks for connecting with us. We’d like you to complete a short micro-screen so we can capture a bit more signal before the next step.\n\n` +
          `Best,\nRecruiting Team`,
      },
    ];
  }

  return [
    {
      kind: "REDIRECT",
      subject: "Thanks for connecting with us",
      body:
        `Hi ${name},\n\n` +
        `Thank you for taking the time to connect with us. At the moment, we may not have the best fit for this specific role, but we appreciate your interest and can point you to other opportunities.\n\n` +
        `Best,\nRecruiting Team`,
    },
  ];
}

function buildActPreviewSteps(payload: {
  stage: AtsStage;
  tags: string[];
  tasks: AtsTask[];
}): NovaActStepPreview[] {
  return [
    {
      step: "Open ATS candidate record",
      details: "Navigate to the candidate profile in the existing ATS",
      status: "Queued",
    },
    {
      step: "Write structured note",
      details: "Paste ATS-ready recruiter note",
      status: "Queued",
    },
    {
      step: "Apply tags",
      details: `Add tags: ${payload.tags.slice(0, 6).join(", ")}`,
      status: "Queued",
    },
    {
      step: "Update stage",
      details: `Move candidate to ${payload.stage}`,
      status: "Queued",
      requiresApproval: true,
    },
    {
      step: "Create follow-up tasks",
      details: `Create ${payload.tasks.length} task(s) in ATS`,
      status: "Queued",
    },
  ];
}

function buildSummary(packet: CandidatePacketLike, stage: AtsStage): string {
  return [
    `${laneLabel(packet.triage.lane)}`,
    `fit ${pct(packet.triage.fitScore)}`,
    `risk ${pct(packet.verify.riskScore)}`,
    `stage ${stage}`,
    packet.microscreen
      ? `micro-screen ${packet.microscreen.overall.toFixed(2)}/5`
      : "no micro-screen",
  ].join(" • ");
}

export function toAtsUpdatePayload(packet: CandidatePacketLike): AtsUpdatePayload {
  const stage = mapStage({
    lane: packet.triage.lane,
    riskScore: packet.verify.riskScore,
    microscreenOverall: packet.microscreen?.overall,
  });

  const tags = buildTags(packet, stage);
  const tasks = buildTasks(packet, stage);
  const note = buildStructuredNote(packet, stage);
  const emailDrafts = buildEmailDrafts(packet, stage);
  const actPreviewSteps = buildActPreviewSteps({ stage, tags, tasks });
  const summary = buildSummary(packet, stage);

  return {
    candidateId: packet.candidateId,
    roleId: packet.roleId,
    stage,
    tags,
    note,
    tasks,
    emailDrafts,
    actPreviewSteps,
    summary,
    debug: {
      lane: packet.triage.lane,
      fitScore: packet.triage.fitScore,
      riskScore: packet.verify.riskScore,
      microscreenOverall: packet.microscreen?.overall,
      flagCount: packet.verify.flags.length,
    },
  };
}