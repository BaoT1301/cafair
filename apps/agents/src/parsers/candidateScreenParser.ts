// Path: apps/llm/agents/src/parsers/candidateScreenParser.ts
//
// Normalizes model output for recruiter-side candidate screening.
// Accepts raw model text (often JSON or JSON inside markdown fences) and returns
// a stable internal shape for the rest of the app.

export interface CandidateScreenParsed {
  score: number;
  strengths: string[];
  concerns: string[];
  summary: string;
  recommendation: "INTERVIEW" | "SCREEN" | "HOLD" | "REJECT";
}

export interface CandidateScreenParseResult {
  ok: boolean;
  value: CandidateScreenParsed;
  parseError?: string;
  rawExtractedJson?: string;
}

const DEFAULT_VALUE: CandidateScreenParsed = {
  score: 75,
  strengths: [],
  concerns: [],
  summary: "Candidate screening completed.",
  recommendation: "SCREEN",
};

function cleanText(text?: string): string {
  return (text ?? "").trim();
}

function uniqStrings(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const out = items
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(out));
}

function clampScore(n: unknown): number {
  const value = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(value)) return DEFAULT_VALUE.score;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeRecommendation(
  value: unknown
): CandidateScreenParsed["recommendation"] {
  const v = String(value ?? "").trim().toUpperCase();

  if (v === "INTERVIEW") return "INTERVIEW";
  if (v === "SCREEN") return "SCREEN";
  if (v === "HOLD") return "HOLD";
  if (v === "REJECT") return "REJECT";

  return DEFAULT_VALUE.recommendation;
}

function extractJsonBlock(text: string): string | null {
  const trimmed = cleanText(text);
  if (!trimmed) return null;

  // Strip markdown code fences if present
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  // Fallback: first JSON object block
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return objectMatch[0].trim();
  }

  return null;
}

function safeParseObject(text: string): { parsed: any | null; error?: string } {
  try {
    return { parsed: JSON.parse(text) };
  } catch (err) {
    return {
      parsed: null,
      error: err instanceof Error ? err.message : "JSON parse failed",
    };
  }
}

export function parseCandidateScreenText(
  text: string
): CandidateScreenParseResult {
  const extracted = extractJsonBlock(text);

  if (!extracted) {
    return {
      ok: false,
      value: DEFAULT_VALUE,
      parseError: "No JSON object found in model output.",
    };
  }

  const { parsed, error } = safeParseObject(extracted);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      value: DEFAULT_VALUE,
      parseError: error ?? "Parsed value is not an object.",
      rawExtractedJson: extracted,
    };
  }

  const value: CandidateScreenParsed = {
    score: clampScore(parsed.score),
    strengths: uniqStrings(parsed.strengths),
    concerns: uniqStrings(parsed.concerns),
    summary: cleanText(parsed.summary) || DEFAULT_VALUE.summary,
    recommendation: normalizeRecommendation(parsed.recommendation),
  };

  return {
    ok: true,
    value,
    rawExtractedJson: extracted,
  };
}