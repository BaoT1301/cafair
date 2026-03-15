// Path: apps/llm/agents/src/schema/candidateScreenSchema.ts
//
// Shared schema + validation helpers for recruiter-side candidate screening.
// Strong validation layer for Bedrock / Nova structured output.
//
// Install:
//   npm install zod

import { z } from "zod";

export const CandidateScreenProviderEnum = z.enum([
  "stub",
  "bedrock-converse",
  "bedrock-invoke",
]);

export const CandidateScreenRecommendationEnum = z.enum([
  "INTERVIEW",
  "SCREEN",
  "HOLD",
  "REJECT",
]);

export const CandidateScreenSchema = z.object({
  score: z.number().min(0).max(100),
  strengths: z.array(z.string().min(1)).default([]),
  concerns: z.array(z.string().min(1)).default([]),
  summary: z.string().min(1),
  recommendation: CandidateScreenRecommendationEnum,
});

export type CandidateScreenSchemaType = z.infer<typeof CandidateScreenSchema>;

export const CandidateScreenSchemaWithMeta = z.object({
  candidateId: z.string().min(1),
  modelId: z.string().min(1).optional(),
  provider: CandidateScreenProviderEnum.optional(),
  degraded: z.boolean().optional(),
  usedFallback: z.boolean().optional(),
  parseOk: z.boolean().optional(),
  validationOk: z.boolean().optional(),
  result: CandidateScreenSchema,
});

export type CandidateScreenSchemaWithMetaType = z.infer<
  typeof CandidateScreenSchemaWithMeta
>;

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "root";
    return `${path}: ${issue.message}`;
  });
}

export function validateCandidateScreen(
  input: unknown
):
  | {
      ok: true;
      data: CandidateScreenSchemaType;
    }
  | {
      ok: false;
      errors: string[];
    } {
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

export function validateCandidateScreenWithMeta(
  input: unknown
):
  | {
      ok: true;
      data: CandidateScreenSchemaWithMetaType;
    }
  | {
      ok: false;
      errors: string[];
    } {
  const parsed = CandidateScreenSchemaWithMeta.safeParse(input);

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

function toCleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toRecommendation(
  value: unknown
): CandidateScreenSchemaType["recommendation"] {
  const raw =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  if (
    raw === "INTERVIEW" ||
    raw === "SCREEN" ||
    raw === "HOLD" ||
    raw === "REJECT"
  ) {
    return raw;
  }

  return "SCREEN";
}

function toScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(n)) return 75;

  return Math.max(0, Math.min(100, Math.round(n)));
}

// Safe normalization helper for near-valid model output.
export function normalizeCandidateScreenLoose(
  input: unknown
): CandidateScreenSchemaType {
  const obj = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;

  const score = toScore(obj.score);
  const strengths = toCleanStringArray(obj.strengths);
  const concerns = toCleanStringArray(obj.concerns);

  const summary =
    typeof obj.summary === "string" && obj.summary.trim()
      ? obj.summary.trim()
      : "Candidate screening completed.";

  const recommendation = toRecommendation(obj.recommendation);

  return {
    score,
    strengths,
    concerns,
    summary,
    recommendation,
  };
}