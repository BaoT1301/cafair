// apps/llm/agents/src/agents/verify.ts

import type { CandidateArtifacts, EvidenceItem, TriageRequest } from "../types";
/**
 * Verification Agent (stub-first)
 * - Finds inconsistencies across resume / transcript / essay
 * - Flags suspicious patterns (template-y text, missing substantiation, etc.)
 * - Suggests 2–3 recruiter actions to resolve risk quickly
 */

export type FlagSeverity = "LOW" | "MEDIUM" | "HIGH";

export type FlagType =
  | "CLAIM_MISMATCH"
  | "SUSPICIOUS_TEXT_PATTERN"
  | "MISSING_SUBSTANTIATION"
  | "INCOMPLETE_PROFILE";

export interface VerifyFlag {
  type: FlagType;
  severity: FlagSeverity;
  reason: string;
  evidence: EvidenceItem[];
}

export interface VerifyMismatch {
  field: string;
  resumeClaim?: string;
  transcriptClaim?: string;
  essayClaim?: string;
  why: string;
}

export interface VerifyAction {
  action:
    | "ASK_FOLLOWUP"
    | "REQUEST_LINKEDIN"
    | "REQUEST_PORTFOLIO"
    | "SEND_CODE_SCREEN"
    | "REQUEST_TRANSCRIPT_EXPORT";
  label: string;
}

export interface VerifyRequest {
  candidateId: string;
  roleId: string;
  roleName?: string;
  artifacts: CandidateArtifacts;

  // optional context to compare against role expectations
  mustHaveKeywords?: string[];
}

export interface VerifyResult {
  candidateId: string;
  roleId: string;

  riskScore: number; // 0..1
  flags: VerifyFlag[];
  mismatches: VerifyMismatch[];
  suggestedActions: VerifyAction[];

  summary: string;

  debug?: {
    resumeLen: number;
    transcriptLen: number;
    essayLen: number;
  };
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function clip01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function extractYearsClaims(text: string): string[] {
  // e.g., "3 years", "2+ years", "5 yrs"
  const t = text;
  const matches = t.match(/\b(\d{1,2})\s*\+?\s*(years|yrs)\b/gi) ?? [];
  return matches;
}

function extractGraduationClaims(text: string): string[] {
  // e.g., "Class of 2026", "Graduation 2025"
  const matches = text.match(/\b(class of|graduation)\s*(20\d{2})\b/gi) ?? [];
  return matches;
}

function hasTemplateySignals(text: string): boolean {
  const t = normalizeText(text);
  const phrases = [
    "as an ai language model",
    "i am excited to apply",
    "i am writing to express my interest",
    "thank you for your consideration",
    "in conclusion",
    "furthermore",
  ];
  return phrases.some((p) => t.includes(p));
}

function keywordCoverage(text: string, mustHaves: string[]) {
  const t = normalizeText(text);
  let hit = 0;
  for (const k of mustHaves) {
    const kk = normalizeText(k);
    if (kk && t.includes(kk)) hit += 1;
  }
  return mustHaves.length ? hit / mustHaves.length : 1;
}

function makeEvidence(label: string, source: EvidenceItem["source"], quote?: string): EvidenceItem {
  return { label, source, quote };
}

export function runVerify(req: VerifyRequest): VerifyResult {
  const resume = req.artifacts.resumeText ?? "";
  const transcript = req.artifacts.transcriptText ?? "";
  const essay = req.artifacts.essayText ?? "";

  const flags: VerifyFlag[] = [];
  const mismatches: VerifyMismatch[] = [];

  const resumeYears = extractYearsClaims(resume);
  const transcriptYears = extractYearsClaims(transcript);

  const resumeGrad = extractGraduationClaims(resume);
  const transcriptGrad = extractGraduationClaims(transcript);

  // 1) Claim mismatch: years of experience vs grad year can be suspicious (heuristic)
  if (resumeYears.length && resumeGrad.length) {
    // if someone claims "10 years" but also "Class of 2026" -> suspicious
    const yearsNum = parseInt((resumeYears[0].match(/\d+/) ?? ["0"])[0], 10);
    if (yearsNum >= 8) {
      mismatches.push({
        field: "experience_years_vs_graduation",
        resumeClaim: `${resumeYears[0]} + ${resumeGrad[0]}`,
        why: "High years-of-experience claim may conflict with near-term graduation.",
      });
      flags.push({
        type: "CLAIM_MISMATCH",
        severity: "HIGH",
        reason: "Experience years claim may conflict with graduation timeline.",
        evidence: [
          makeEvidence("Resume experience claim", "resume", resumeYears[0]),
          makeEvidence("Resume graduation claim", "resume", resumeGrad[0]),
        ],
      });
    }
  }

  // 2) Compare resume vs transcript “years” claims
  if (resumeYears.length && transcriptYears.length && resumeYears[0] !== transcriptYears[0]) {
    mismatches.push({
      field: "experience_years",
      resumeClaim: resumeYears[0],
      transcriptClaim: transcriptYears[0],
      why: "Candidate gave different experience years across artifacts.",
    });
    flags.push({
      type: "CLAIM_MISMATCH",
      severity: "MEDIUM",
      reason: "Different experience-year claims across resume vs fair conversation.",
      evidence: [
        makeEvidence("Resume claim", "resume", resumeYears[0]),
        makeEvidence("Transcript claim", "transcript", transcriptYears[0]),
      ],
    });
  }

  // 3) Transcript says “I built X”, but resume is very empty -> missing substantiation
  const resumeLen = resume.trim().length;
  const transcriptLen = transcript.trim().length;
  if (transcriptLen > 120 && resumeLen < 120) {
    flags.push({
      type: "MISSING_SUBSTANTIATION",
      severity: "MEDIUM",
      reason: "Strong claims in conversation but resume content is too thin to verify.",
      evidence: [
        makeEvidence("Transcript has substantial claims", "transcript", transcript.slice(0, 120) + "..."),
        makeEvidence("Resume too short", "resume", `resume length ~${resumeLen} chars`),
      ],
    });
  }

  // 4) Essay suspicious template-y patterns
  const essayLen = essay.trim().length;
  if (essayLen > 80 && hasTemplateySignals(essay)) {
    flags.push({
      type: "SUSPICIOUS_TEXT_PATTERN",
      severity: "MEDIUM",
      reason: "Essay contains common template phrases; may not reflect authentic writing.",
      evidence: [makeEvidence("Template-like phrase detected", "essay", "Contains generic cover-letter style phrases")],
    });
  }

  // 5) Incomplete profile
  if (!resumeLen && !transcriptLen && !essayLen) {
    flags.push({
      type: "INCOMPLETE_PROFILE",
      severity: "HIGH",
      reason: "No artifacts provided to verify the candidate.",
      evidence: [makeEvidence("Missing artifacts", "resume", "No resume/transcript/essay text available")],
    });
  }

  // 6) Must-have coverage risk (if provided)
  if (req.mustHaveKeywords?.length) {
    const coverage = keywordCoverage([resume, transcript, essay].join("\n"), req.mustHaveKeywords);
    if (coverage < 0.5) {
      flags.push({
        type: "MISSING_SUBSTANTIATION",
        severity: "LOW",
        reason: "Low must-have coverage across artifacts; may be a weak fit or missing details.",
        evidence: [makeEvidence("Must-have coverage low", "resume", `coverage ~${Math.round(coverage * 100)}%`)],
      });
    }
  }

  // risk score (simple)
  let risk = 0;
  for (const f of flags) {
    if (f.severity === "HIGH") risk += 0.35;
    if (f.severity === "MEDIUM") risk += 0.2;
    if (f.severity === "LOW") risk += 0.1;
  }
  risk = clip01(risk);

  const suggestedActions: VerifyAction[] = (() => {
    // 2–3 actions depending on flags
    const actions: VerifyAction[] = [];
    if (flags.some((f) => f.type === "CLAIM_MISMATCH")) {
      actions.push({ action: "ASK_FOLLOWUP", label: "Ask a 30-sec clarification question" });
      actions.push({ action: "REQUEST_LINKEDIN", label: "Request LinkedIn to confirm timeline" });
    }
    if (flags.some((f) => f.type === "SUSPICIOUS_TEXT_PATTERN")) {
      actions.push({ action: "SEND_CODE_SCREEN", label: "Send quick coding screen" });
    }
    if (flags.some((f) => f.type === "MISSING_SUBSTANTIATION")) {
      actions.push({ action: "REQUEST_PORTFOLIO", label: "Request portfolio/GitHub link" });
    }
    if (actions.length < 2) actions.push({ action: "REQUEST_TRANSCRIPT_EXPORT", label: "Export transcript for review" });
    return actions.slice(0, 3);
  })();

  const summary =
    risk >= 0.6
      ? "High verification risk: review mismatches and request proof links."
      : risk >= 0.3
      ? "Moderate verification risk: confirm key claims with a quick follow-up."
      : "Low verification risk: proceed normally.";

  return {
    candidateId: req.candidateId,
    roleId: req.roleId,
    riskScore: risk,
    flags,
    mismatches,
    suggestedActions,
    summary,
    debug: { resumeLen, transcriptLen, essayLen },
  };
}