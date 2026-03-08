// apps/llm/agents/src/agents/microscreen.ts

import type { EvidenceItem } from "../types";

export interface MicroScreenRequest {
  candidateId: string;
  roleId: string;
  roleName?: string;

  mustHaveKeywords?: string[];
  questions?: string[]; // optional: record prompts used
  responseTranscriptText: string; // text transcript of voice/text answers
}

export interface MicroScreenScores {
  communication: number; // 0..5
  roleFit: number;       // 0..5
  depth: number;         // 0..5
}

export interface MicroScreenResult {
  candidateId: string;
  roleId: string;

  scores: MicroScreenScores;
  overall: number; // 0..5
  confidence: number; // 0..1

  highlights: string[];
  redFlags: string[];
  followups: string[];

  evidence: EvidenceItem[];
  summary: string;
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function clip(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
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

function pullHighlights(text: string): string[] {
  // stub: pick sentences containing “built/ship/impact/metric”
  const sentences = text.split(/[.?!]\s+/).map((s) => s.trim()).filter(Boolean);
  const keys = ["built", "shipped", "impact", "metric", "improved", "deployed", "users"];
  const hi = sentences.filter((s) => keys.some((k) => normalizeText(s).includes(k))).slice(0, 3);
  return hi.length ? hi : sentences.slice(0, 2);
}

export function runMicroScreen(req: MicroScreenRequest): MicroScreenResult {
  const t = req.responseTranscriptText.trim();
  const tNorm = normalizeText(t);
  const len = t.length;

  const must = req.mustHaveKeywords ?? [];
  const cov = keywordCoverage(t, must);

  // Communication: basic length + structure
  const hasStructure = ["because", "for example", "so that", "result", "impact"].some((k) => tNorm.includes(k));
  let communication = 2.0;
  if (len > 120) communication += 1;
  if (len > 250) communication += 1;
  if (hasStructure) communication += 1;
  communication = clip(communication, 0, 5);

  // Role fit: must-have coverage
  let roleFit = clip(1 + 4 * cov, 0, 5);

  // Depth: mentions concrete tools + shipping
  const depthSignals = ["deployed", "production", "latency", "a/b", "evaluation", "benchmark", "unit test", "docker", "aws"];
  const depthCount = depthSignals.filter((k) => tNorm.includes(k)).length;
  let depth = clip(1.5 + depthCount * 0.6, 0, 5);

  const overall = clip((communication + roleFit + depth) / 3, 0, 5);

  const confidence = clip(Math.min(len, 500) / 500, 0.2, 1);

  const highlights = pullHighlights(t);
  const redFlags: string[] = [];
  if (len < 80) redFlags.push("Very short answers; may lack substance.");
  if (cov < 0.34 && must.length) redFlags.push("Low must-have coverage; may be off-role or missing details.");

  const followups: string[] = [];
  if (must.length) {
    const missing = must.filter((k) => !tNorm.includes(normalizeText(k)));
    for (const m of missing.slice(0, 2)) {
      followups.push(`Can you briefly describe your experience with ${m}?`);
    }
  }
  followups.push("What is one project you shipped end-to-end and how did you evaluate success?");

  const evidence: EvidenceItem[] = [];
  if (must.length) {
    evidence.push({
      label: "Must-have coverage",
      quote: `${Math.round(cov * 100)}%`,
      source: "transcript",
      scoreImpact: roleFit >= 3 ? +0.05 : -0.05,
    });
  }
  if (hasStructure) {
    evidence.push({
      label: "Structured reasoning signal",
      quote: "Uses causal/impact phrasing (because/for example/impact)",
      source: "transcript",
      scoreImpact: +0.03,
    });
  }

  const summary =
    overall >= 4
      ? "Strong micro-screen: recommend scheduling interview."
      : overall >= 3
      ? "Decent micro-screen: schedule if capacity allows; ask follow-ups."
      : "Weak micro-screen: consider redirect or deeper screening.";

  return {
    candidateId: req.candidateId,
    roleId: req.roleId,
    scores: { communication, roleFit, depth },
    overall,
    confidence,
    highlights,
    redFlags,
    followups,
    evidence,
    summary,
  };
}