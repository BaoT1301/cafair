// Path: apps/llm/agents/src/parsers/socialScreenParser.ts
//
// Parser for AI Social Intelligence output.
// Supports:
// - fenced JSON
// - raw JSON object
// - light normalization
//
// It returns a richer social-screen structure while also exposing
// legacy convenience fields for UI compatibility.

export type SocialFindingSeverity =
  | "VERIFIED"
  | "WARNING"
  | "CRITICAL"
  | "INFO";

export type SocialFindingSource = "linkedin" | "github" | "web";

export type SocialRisk = "low" | "medium" | "high";

export interface SocialFindingParsed {
  severity: SocialFindingSeverity;
  source: SocialFindingSource;
  title: string;
  detail: string;
  confidence: number; // 0..1
}

export interface SocialScreenParsed {
  socialScore: number;
  verifiedCount: number;
  warningCount: number;
  criticalCount: number;
  infoCount: number;
  findings: SocialFindingParsed[];
  recommendation: string;
  summary: string;

  // legacy convenience aliases
  fitScore: number;
  risk: SocialRisk;
  strengths: string[];
  concerns: string[];
  flags: string[];
}

export interface SocialScreenParseResult {
  ok: boolean;
  value: SocialScreenParsed;
  parseError?: string;
  rawExtractedJson?: string;
}

const DEFAULT_VALUE: SocialScreenParsed = {
  socialScore: 80,
  verifiedCount: 0,
  warningCount: 0,
  criticalCount: 0,
  infoCount: 0,
  findings: [],
  recommendation: "Proceed with normal recruiter review.",
  summary: "Social screening completed.",
  fitScore: 80,
  risk: "low",
  strengths: [],
  concerns: [],
  flags: [],
};

function cleanText(text?: string): string {
  return (text ?? "").trim();
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clampScore(n: unknown): number {
  const value = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(value)) return DEFAULT_VALUE.socialScore;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSeverity(value: unknown): SocialFindingSeverity {
  const v = String(value ?? "").trim().toUpperCase();

  if (v === "VERIFIED") return "VERIFIED";
  if (v === "WARNING") return "WARNING";
  if (v === "CRITICAL") return "CRITICAL";
  return "INFO";
}

function normalizeSource(value: unknown): SocialFindingSource {
  const v = String(value ?? "").trim().toLowerCase();

  if (v === "linkedin") return "linkedin";
  if (v === "github") return "github";
  return "web";
}

function normalizeRiskFromCounts(args: {
  criticalCount: number;
  warningCount: number;
}): SocialRisk {
  if (args.criticalCount > 0) return "high";
  if (args.warningCount > 0) return "medium";
  return "low";
}

function extractJsonBlock(text: string): string | null {
  const trimmed = cleanText(text);
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) return objectMatch[0].trim();

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

function normalizeFindings(value: unknown): SocialFindingParsed[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const obj =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

      const title = cleanText(
        typeof obj.title === "string" ? obj.title : "Untitled finding"
      );

      const detail = cleanText(
        typeof obj.detail === "string"
          ? obj.detail
          : typeof obj.summary === "string"
            ? obj.summary
            : ""
      );

      const confidenceRaw =
        typeof obj.confidence === "number"
          ? obj.confidence
          : Number(obj.confidence);

      return {
        severity: normalizeSeverity(obj.severity),
        source: normalizeSource(obj.source),
        title,
        detail,
        confidence: Number.isFinite(confidenceRaw)
          ? clamp01(confidenceRaw)
          : 0.75,
      };
    })
    .filter((f) => Boolean(f.title));
}

export function parseSocialScreenText(
  text: string
): SocialScreenParseResult {
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

  const findings = normalizeFindings(parsed.findings);

  const verifiedCount = findings.filter(
    (f) => f.severity === "VERIFIED"
  ).length;
  const warningCount = findings.filter(
    (f) => f.severity === "WARNING"
  ).length;
  const criticalCount = findings.filter(
    (f) => f.severity === "CRITICAL"
  ).length;
  const infoCount = findings.filter((f) => f.severity === "INFO").length;

  const socialScore = clampScore(
    parsed.socialScore ?? parsed.fitScore ?? parsed.score
  );

  const strengths = findings
    .filter((f) => f.severity === "VERIFIED")
    .map((f) => `${f.title} — ${f.detail}`)
    .slice(0, 6);

  const concerns = findings
    .filter((f) => f.severity === "WARNING" || f.severity === "CRITICAL")
    .map((f) => `${f.title} — ${f.detail}`)
    .slice(0, 6);

  const flags = findings
    .filter((f) => f.severity === "WARNING" || f.severity === "CRITICAL")
    .map((f) => f.title)
    .slice(0, 6);

  const risk = normalizeRiskFromCounts({
    criticalCount,
    warningCount,
  });

  const value: SocialScreenParsed = {
    socialScore,
    verifiedCount,
    warningCount,
    criticalCount,
    infoCount,
    findings,
    recommendation:
      cleanText(parsed.recommendation) ||
      DEFAULT_VALUE.recommendation,
    summary: cleanText(parsed.summary) || DEFAULT_VALUE.summary,
    fitScore: socialScore,
    risk,
    strengths,
    concerns,
    flags,
  };

  return {
    ok: true,
    value,
    rawExtractedJson: extracted,
  };
}