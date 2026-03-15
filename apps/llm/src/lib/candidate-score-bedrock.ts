import { z } from "zod";
import {
  generateStructuredJsonWithBedrock,
  type BedrockClientMetrics,
  type BedrockConfig,
  type BedrockProvider,
} from "./bedrock-client.js";

const CandidateScreenRecommendationEnum = z.enum([
  "INTERVIEW",
  "SCREEN",
  "HOLD",
  "REJECT",
]);

const CandidateScreenSchema = z.object({
  score: z.number().min(0).max(100),
  strengths: z.array(z.string().min(1)).default([]),
  concerns: z.array(z.string().min(1)).default([]),
  summary: z.string().min(1),
  recommendation: CandidateScreenRecommendationEnum,
});

type CandidateScreenValue = z.infer<typeof CandidateScreenSchema>;

export interface BedrockCandidateScoreInput {
  candidateId: string;
  resumeText: string;
  jobDescription: string;
  config?: BedrockConfig;
}

export interface BedrockCandidateScoreResult {
  fit_score: number;
  strengths: string[];
  gaps: string[];
  risk_level: "low" | "medium" | "high";
  summary: string;
  provider: BedrockProvider;
  modelId: string;
  degraded: boolean;
  usedFallback: boolean;
  parseOk: boolean;
  validationOk: boolean;
  parseError?: string;
  validationErrors?: string[];
  raw?: unknown;
  metrics?: BedrockClientMetrics;
}

function cleanText(text?: string): string {
  return (text ?? "").trim();
}

function uniqStrings(items: unknown): string[] {
  if (!Array.isArray(items)) return [];

  const values = items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return Array.from(new Set(values));
}

function clampScore(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 75;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeRecommendation(
  value: unknown,
): CandidateScreenValue["recommendation"] {
  const raw = String(value ?? "").trim().toUpperCase();

  if (raw === "INTERVIEW") return "INTERVIEW";
  if (raw === "SCREEN") return "SCREEN";
  if (raw === "HOLD") return "HOLD";
  if (raw === "REJECT") return "REJECT";

  return "SCREEN";
}

function extractJsonBlock(text: string): string | null {
  const trimmed = cleanText(text);
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch?.[0]?.trim() ?? null;
}

function normalizeCandidateScreenLoose(input: unknown): CandidateScreenValue {
  const object =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    score: clampScore(object.score),
    strengths: uniqStrings(object.strengths),
    concerns: uniqStrings(object.concerns),
    summary:
      cleanText(typeof object.summary === "string" ? object.summary : "") ||
      "Candidate screening completed.",
    recommendation: normalizeRecommendation(object.recommendation),
  };
}

function parseCandidateScreenText(text: string): {
  ok: boolean;
  value: CandidateScreenValue;
  parseError?: string;
} {
  const extracted = extractJsonBlock(text);

  if (!extracted) {
    return {
      ok: false,
      value: normalizeCandidateScreenLoose({}),
      parseError: "No JSON object found in model output.",
    };
  }

  try {
    const parsed = JSON.parse(extracted);
    return {
      ok: true,
      value: normalizeCandidateScreenLoose(parsed),
    };
  } catch (error) {
    return {
      ok: false,
      value: normalizeCandidateScreenLoose({}),
      parseError:
        error instanceof Error ? error.message : "JSON parse failed for candidate score",
    };
  }
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "root";
    return `${path}: ${issue.message}`;
  });
}

function validateCandidateScreen(
  input: unknown,
):
  | { ok: true; data: CandidateScreenValue }
  | { ok: false; errors: string[] } {
  const parsed = CandidateScreenSchema.safeParse(input);

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  return {
    ok: false,
    errors: formatZodErrors(parsed.error),
  };
}

function buildCandidateScorePrompt(input: BedrockCandidateScoreInput): {
  feature: string;
  system: string;
  prompt: string;
  schemaHint: string;
} {
  const system = [
    "You are a recruiter copilot for a high-volume hiring workflow.",
    "Evaluate the candidate for role fit using only the provided evidence.",
    "Be concise, evidence-based, and avoid unsupported claims.",
    "Return strict JSON only.",
  ].join(" ");

  const schemaHint = JSON.stringify(
    {
      score: 0,
      strengths: ["string"],
      concerns: ["string"],
      summary: "string",
      recommendation: "INTERVIEW | SCREEN | HOLD | REJECT",
    },
    null,
    2,
  );

  const prompt = [
    "Prompt Version: candidate_score_v1",
    `Candidate ID: ${input.candidateId}`,
    "",
    "Resume:",
    cleanText(input.resumeText) || "N/A",
    "",
    "Job Description:",
    cleanText(input.jobDescription) || "N/A",
    "",
    "Task:",
    "- Score overall fit from 0 to 100.",
    "- List 2 to 5 evidence-backed strengths from the resume.",
    "- List 1 to 4 concrete concerns or missing requirements.",
    "- Give a short summary.",
    "- Recommend one next stage.",
    "",
    "Return ONLY valid JSON matching this schema:",
    schemaHint,
  ].join("\n");

  return {
    feature: "candidate_score",
    system,
    prompt,
    schemaHint,
  };
}

function recommendationToRiskLevel(
  recommendation: CandidateScreenValue["recommendation"],
  score: number,
): "low" | "medium" | "high" {
  if (recommendation === "REJECT") return "high";
  if (recommendation === "HOLD") return "medium";
  if (recommendation === "INTERVIEW") {
    return score >= 80 ? "low" : "medium";
  }
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "high";
}

export async function scoreCandidateWithBedrock(
  input: BedrockCandidateScoreInput,
): Promise<BedrockCandidateScoreResult> {
  const promptBundle = buildCandidateScorePrompt(input);

  const modelResponse = await generateStructuredJsonWithBedrock<{
    score?: number;
    strengths?: string[];
    concerns?: string[];
    summary?: string;
    recommendation?: CandidateScreenValue["recommendation"] | string;
  }>(
    {
      feature: promptBundle.feature,
      system: promptBundle.system,
      prompt: promptBundle.prompt,
      schemaHint: promptBundle.schemaHint,
      config: input.config,
    },
    {
      preferConverse: true,
      maxAttempts: 3,
      logMetrics: true,
    },
  );

  const parsedFromText = parseCandidateScreenText(modelResponse.text);
  const candidateValue =
    modelResponse.parsed && typeof modelResponse.parsed === "object"
      ? normalizeCandidateScreenLoose(modelResponse.parsed)
      : parsedFromText.value;

  const validated = validateCandidateScreen(candidateValue);
  const finalValue = validated.ok
    ? validated.data
    : normalizeCandidateScreenLoose(candidateValue);

  return {
    fit_score: finalValue.score,
    strengths: finalValue.strengths,
    gaps: finalValue.concerns,
    risk_level: recommendationToRiskLevel(
      finalValue.recommendation,
      finalValue.score,
    ),
    summary: finalValue.summary,
    provider: modelResponse.provider,
    modelId:
      modelResponse.modelId ??
      input.config?.modelId ??
      process.env.BEDROCK_MODEL_ID ??
      process.env.NOVA_MODEL_ID ??
      "amazon.nova-lite-v1:0",
    degraded: modelResponse.degraded,
    usedFallback: modelResponse.usedFallback,
    parseOk: Boolean(modelResponse.parsed) || parsedFromText.ok,
    validationOk: validated.ok,
    parseError:
      modelResponse.parseError ||
      (!parsedFromText.ok ? parsedFromText.parseError : undefined),
    validationErrors: validated.ok ? undefined : validated.errors,
    raw: modelResponse.raw,
    metrics: modelResponse.metrics,
  };
}
