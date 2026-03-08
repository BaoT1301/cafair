// apps/llm/agents/src/agents/triage.ts

import type {
  EvidenceItem,
  Lane,
  RoleProfile,
  TriageRequest,
  TriageResult,
} from "../types";

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function clip01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function findKeywordHits(text: string, keywords: string[]): string[] {
  const t = normalizeText(text);
  const hits: string[] = [];
  for (const kw of keywords) {
    const k = normalizeText(kw);
    if (!k) continue;
    if (t.includes(k)) hits.push(kw);
  }
  return uniq(hits);
}

function pickLane(score: number, role: RoleProfile): Lane {
  const recruiterNow = role.thresholds?.recruiterNow ?? 0.72;
  const quickScreen = role.thresholds?.quickScreen ?? 0.45;

  if (score >= recruiterNow) return "RECRUITER_NOW";
  if (score >= quickScreen) return "QUICK_ASYNC_SCREEN";
  return "POLITE_REDIRECT";
}

function makeSummary(lane: Lane, fitScore: number, missingMustHave: string[]) {
  const pct = Math.round(fitScore * 100);
  if (lane === "RECRUITER_NOW") return `Strong match (${pct}%). Route to recruiter now.`;
  if (lane === "QUICK_ASYNC_SCREEN") return `Potential match (${pct}%). Send a 3-minute async screen.`;
  if (missingMustHave.length) return `Low fit (${pct}%). Missing must-haves: ${missingMustHave.slice(0, 3).join(", ")}.`;
  return `Low fit (${pct}%). Politely redirect.`;
}

export function runTriage(req: TriageRequest): TriageResult {
  const role = req.role;

  const resume = req.artifacts.resumeText ?? "";
  const essay = req.artifacts.essayText ?? "";
  const transcript = req.artifacts.transcriptText ?? "";
  const combined = [resume, essay, transcript].filter(Boolean).join("\n\n");

  const mustHave = role.mustHaveKeywords ?? [];
  const nice = role.niceToHaveKeywords ?? [];

  const matchedMustHave = mustHave.length ? findKeywordHits(combined, mustHave) : [];
  const matchedNice = nice.length ? findKeywordHits(combined, nice) : [];
  const missingMustHave = mustHave.filter((k) => !matchedMustHave.includes(k));

  const allKeywords = uniq([...mustHave, ...nice]);
  const allHits = allKeywords.length ? findKeywordHits(combined, allKeywords) : [];
  const keywordScore = allKeywords.length ? allHits.length / allKeywords.length : 0.25;

  const mustHaveScore = mustHave.length ? matchedMustHave.length / mustHave.length : 0.7;

  const t = normalizeText(combined);
  const hasRecent = t.includes("2026") || t.includes("2025") || t.includes("2024");
  const recencyScore = hasRecent ? 1 : 0.4;

  const wKeyword = role.weights?.keywordMatch ?? 0.6;
  const wMustHave = role.weights?.mustHave ?? 0.3;
  const wRecency = role.weights?.recencySignal ?? 0.1;

  let fitScore = wKeyword * keywordScore + wMustHave * mustHaveScore + wRecency * recencyScore;

  if (mustHave.length >= 3 && missingMustHave.length >= 2) fitScore -= 0.15;
  if (mustHave.length >= 5 && missingMustHave.length >= 3) fitScore -= 0.2;

  fitScore = clip01(fitScore);

  const lane = pickLane(fitScore, role);

  const textLen = combined.length;
  const evidenceMass = matchedMustHave.length * 2 + matchedNice.length;
  const confidence = clip01((Math.min(textLen, 1500) / 1500) * 0.6 + (Math.min(evidenceMass, 8) / 8) * 0.4);

  const evidence: EvidenceItem[] = [];

  for (const kw of matchedMustHave.slice(0, 6)) {
    evidence.push({
      label: "Matched must-have keyword",
      keyword: kw,
      source: resume ? "resume" : transcript ? "transcript" : "essay",
      scoreImpact: +0.05,
    });
  }

  for (const kw of matchedNice.slice(0, 6)) {
    evidence.push({
      label: "Matched nice-to-have keyword",
      keyword: kw,
      source: resume ? "resume" : transcript ? "transcript" : "essay",
      scoreImpact: +0.02,
    });
  }

  if (missingMustHave.length) {
    evidence.push({
      label: "Missing must-have keywords",
      quote: missingMustHave.slice(0, 6).join(", "),
      source: "resume",
      scoreImpact: -0.12,
    });
  }

  const nextActions =
    lane === "RECRUITER_NOW"
      ? [{ action: "INVITE_RECRUITER_CHAT", reason: "High fit score and must-have coverage." }]
      : lane === "QUICK_ASYNC_SCREEN"
      ? [{ action: "SEND_MICRO_SCREEN", reason: "Quick confirmation before recruiter time." }]
      : [{ action: "REDIRECT_WITH_RESOURCES", reason: "Low fit or missing key must-haves." }];

  return {
    candidateId: req.candidateId,
    roleId: role.roleId,
    lane,
    fitScore,
    confidence,
    summary: makeSummary(lane, fitScore, missingMustHave),
    evidence,
    nextActions,
    debug: {
      matchedMustHave,
      matchedNiceToHave: matchedNice,
      missingMustHave,
      keywordScore,
      mustHaveScore,
      recencyScore,
    },
  };
}