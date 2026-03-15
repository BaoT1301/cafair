// Path: apps/llm/agents/src/agents/candidatePacket.ts
//
// Candidate Packet Orchestrator (demo-ready).
// Combines triage + verify + microscreen into ONE payload that both
// the candidate-side and recruiter-side UI can render.
//
// Uses your existing agents:
// - runTriage (from triage.ts)
// - runVerify (from verify.ts)
// - runMicroScreen (from microscreen.ts)

import type { RoleProfile, TriageRequest, Lane, TriageResult } from "../types";
import { runTriage } from "./triage";
import { runVerify, type VerifyResult } from "./verify";
import { runMicroScreen, type MicroScreenResult } from "./microscreen";

export type PersonaSide = "candidate" | "recruiter";

export interface RecruiterPromptCard {
  whatWeKnow: string[];
  whatToAsk: string[];
  whatToVerify: string[];
  redFlags: string[];
}

export interface PrimaryCTA {
  label: string;
  action:
    | "OPEN_CHAT"
    | "SEND_MICRO_SCREEN"
    | "REQUEST_LINKEDIN"
    | "REQUEST_PORTFOLIO"
    | "SEND_CODING_SCREEN"
    | "REDIRECT";
  reason: string;
}

export interface CandidatePacketResult {
  candidateId: string;
  roleId: string;

  candidateName?: string;
  roleName?: string;
  companyName?: string;

  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;

  promptCard: RecruiterPromptCard;
  primaryCTA: PrimaryCTA;

  highlights: string[];
  nextSteps: string[];

  summary: string;
  createdAtISO: string;

  debug?: {
    transcriptLen: number;
    resumeLen: number;
    essayLen: number;
    usedMicroScreen: boolean;
  };
}

export interface BuildCandidatePacketArgs extends TriageRequest {
  roleName?: string;
  companyName?: string;
  candidateName?: string;
  side?: PersonaSide;
  enableMicroScreen?: boolean;
  microScreenMinChars?: number;
}

function clip01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function shortPct(x: number): string {
  return `${Math.round(clip01(x) * 100)}%`;
}

function laneLabel(lane: Lane): string {
  if (lane === "RECRUITER_NOW") return "Recruiter Now";
  if (lane === "QUICK_ASYNC_SCREEN") return "Quick Screen";
  return "Redirect";
}

function getSafeRoleName(role: RoleProfile, roleName?: string): string | undefined {
  if (roleName) return roleName;

  if ("title" in role && typeof role.title === "string") {
    return role.title;
  }

  return undefined;
}

function pickPrimaryCTA(args: {
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
  side?: PersonaSide;
}): PrimaryCTA {
  const side = args.side ?? "recruiter";

  if (args.verify.riskScore >= 0.65) {
    const first = args.verify.suggestedActions[0]?.action;

    switch (first) {
      case "REQUEST_LINKEDIN":
        return {
          label: "Request LinkedIn",
          action: "REQUEST_LINKEDIN",
          reason: "High verification risk; confirm timeline.",
        };

      case "REQUEST_PORTFOLIO":
        return {
          label: "Request Portfolio",
          action: "REQUEST_PORTFOLIO",
          reason: "High risk; request proof artifacts.",
        };

      case "SEND_CODE_SCREEN":
        return {
          label: "Send Coding Screen",
          action: "SEND_CODING_SCREEN",
          reason: "High risk; verify skill quickly.",
        };

      case "REQUEST_TRANSCRIPT_EXPORT":
      case "ASK_FOLLOWUP":
      default:
        return {
          label: "Open Chat (Verify)",
          action: "OPEN_CHAT",
          reason: "High risk; ask a short clarification question.",
        };
    }
  }

  if (args.triage.lane === "RECRUITER_NOW") {
    return {
      label: side === "candidate" ? "Join Recruiter Chat" : "Open Chat",
      action: "OPEN_CHAT",
      reason: "Strong fit; proceed with recruiter conversation.",
    };
  }

  if (args.triage.lane === "QUICK_ASYNC_SCREEN") {
    return {
      label: side === "candidate" ? "Take 3-min Screen" : "Send 3-min Screen",
      action: "SEND_MICRO_SCREEN",
      reason: "Needs quick signal before spending recruiter time.",
    };
  }

  return {
    label: side === "candidate" ? "Explore Other Roles" : "Redirect",
    action: "REDIRECT",
    reason: "Not a fit for this role; provide alternatives.",
  };
}

function buildHighlights(args: {
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
}): string[] {
  const hi: string[] = [];

  hi.push(`Fit ${shortPct(args.triage.fitScore)} • ${laneLabel(args.triage.lane)}`);
  hi.push(`Risk ${shortPct(args.verify.riskScore)} • ${args.verify.flags.length} flags`);

  const ev = (args.triage.evidence ?? []).slice(0, 3).map((e) => {
    if (e.keyword) return `Evidence: ${e.keyword}`;
    if (e.quote) return `Evidence: ${e.quote}`;
    return `Evidence: ${e.label}`;
  });

  hi.push(...ev);

  if (args.microscreen?.highlights?.length) {
    hi.push(`Micro-screen: ${args.microscreen.overall.toFixed(2)}/5`);
    hi.push(...args.microscreen.highlights.slice(0, 2).map((s) => `Quote: ${s}`));
  }

  return uniq(hi).slice(0, 6);
}

function buildNextSteps(args: {
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
}): string[] {
  const steps: string[] = [];

  if (args.triage.lane === "RECRUITER_NOW") {
    steps.push("Proceed to recruiter conversation");
  }

  if (args.triage.lane === "QUICK_ASYNC_SCREEN") {
    steps.push("Complete 3-min micro-screen");
  }

  if (args.triage.lane === "POLITE_REDIRECT") {
    steps.push("Redirect to better-fit roles or resources");
  }

  if (args.verify.riskScore >= 0.35) {
    steps.push("Verify key claims with one quick follow-up");
  }

  if (args.microscreen?.followups?.length) {
    steps.push(...args.microscreen.followups.slice(0, 2));
  }

  for (const a of args.verify.suggestedActions.slice(0, 2)) {
    steps.push(a.label);
  }

  return uniq(steps).slice(0, 6);
}

function buildPromptCard(args: {
  role: RoleProfile;
  triage: TriageResult;
  verify: VerifyResult;
  microscreen?: MicroScreenResult;
}): RecruiterPromptCard {
  const must = args.role.mustHaveKeywords ?? [];

  const whatWeKnow: string[] = [
    `Lane: ${laneLabel(args.triage.lane)} • Fit ${shortPct(args.triage.fitScore)}`,
    `Risk: ${shortPct(args.verify.riskScore)}`,
  ];

  const kws = (args.triage.evidence ?? [])
    .map((e) => e.keyword)
    .filter((k): k is string => !!k)
    .slice(0, 4);

  if (kws.length) {
    whatWeKnow.push(`Signals: ${kws.join(", ")}`);
  }

  const whatToAsk: string[] = [];
  if (must.length) {
    whatToAsk.push(`Ask for proof on: ${must.slice(0, 2).join(", ")}`);
  }
  whatToAsk.push("Ask for one shipped project and measurable impact");

  const whatToVerify: string[] = [];
  if (args.verify.flags.length) {
    whatToVerify.push("Clarify mismatched claims");
  }
  if (args.verify.riskScore >= 0.35) {
    whatToVerify.push("Request LinkedIn or portfolio link");
  }

  const redFlags: string[] = [];
  for (const f of args.verify.flags.slice(0, 2)) {
    redFlags.push(`${f.type}: ${f.reason}`);
  }
  if (args.microscreen?.redFlags?.length) {
    redFlags.push(...args.microscreen.redFlags.slice(0, 1));
  }

  return {
    whatWeKnow: uniq(whatWeKnow).slice(0, 4),
    whatToAsk: uniq(whatToAsk).slice(0, 4),
    whatToVerify: uniq(whatToVerify).slice(0, 3),
    redFlags: uniq(redFlags).slice(0, 2),
  };
}

export function buildCandidatePacket(
  args: BuildCandidatePacketArgs
): CandidatePacketResult {
  const createdAtISO = new Date().toISOString();

  const triage = runTriage(args);
  const safeRoleName = getSafeRoleName(args.role, args.roleName);

  const verify = runVerify({
    candidateId: args.candidateId,
    roleId: args.role.roleId,
    roleName: safeRoleName,
    mustHaveKeywords: args.role.mustHaveKeywords ?? [],
    artifacts: args.artifacts,
  });

  const enableMicro = args.enableMicroScreen ?? true;
  const minChars = args.microScreenMinChars ?? 40;
  const transcript = (args.artifacts.transcriptText ?? "").trim();

  const microscreen =
    enableMicro && transcript.length >= minChars
      ? runMicroScreen({
          candidateId: args.candidateId,
          roleId: args.role.roleId,
          roleName: safeRoleName,
          mustHaveKeywords: args.role.mustHaveKeywords ?? [],
          responseTranscriptText: transcript,
        })
      : undefined;

  const promptCard = buildPromptCard({
    role: args.role,
    triage,
    verify,
    microscreen,
  });

  const primaryCTA = pickPrimaryCTA({
    triage,
    verify,
    microscreen,
    side: args.side ?? "recruiter",
  });

  const highlights = buildHighlights({ triage, verify, microscreen });
  const nextSteps = buildNextSteps({ triage, verify, microscreen });

  const summary =
    `Fit ${shortPct(triage.fitScore)} (${laneLabel(triage.lane)}), ` +
    `Risk ${shortPct(verify.riskScore)}. ` +
    (microscreen
      ? `Micro-screen ${microscreen.overall.toFixed(2)}/5.`
      : "No micro-screen yet.");

  return {
    candidateId: args.candidateId,
    roleId: args.role.roleId,
    candidateName: args.candidateName,
    roleName: safeRoleName,
    companyName: args.companyName,
    triage,
    verify,
    microscreen,
    promptCard,
    primaryCTA,
    highlights,
    nextSteps,
    summary,
    createdAtISO,
    debug: {
      transcriptLen: (args.artifacts.transcriptText ?? "").length,
      resumeLen: (args.artifacts.resumeText ?? "").length,
      essayLen: (args.artifacts.essayText ?? "").length,
      usedMicroScreen: !!microscreen,
    },
  };
}