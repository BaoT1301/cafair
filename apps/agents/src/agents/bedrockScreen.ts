// Path: agents/src/agents/bedrockScreen.ts
//
// Recruiter-side Bedrock screening agent for AI Hire AI / FairSignal
// - Uses prompt builders from src/prompts
// - Uses production-style Bedrock service wrapper from src/services
// - Parses and validates structured JSON output
// - Falls back safely with normalized output
//
// Depends on:
//   agents/src/prompts/candidateScreen.ts
//   agents/src/parsers/candidateScreenParser.ts
//   agents/src/schema/candidateScreenSchema.ts
//   agents/src/services/bedrockClient.ts

import {
  buildCandidateScreenPrompt,
  type CandidateScreenPromptInput,
} from "../prompts/candidateScreen";
import { parseCandidateScreenText } from "../parsers/candidateScreenParser";
import {
  normalizeCandidateScreenLoose,
  validateCandidateScreen,
} from "../schema/candidateScreenSchema";
import {
  generateStructuredJsonWithBedrock,
  type BedrockFeatureResponse,
} from "../services/bedrockClient";
import type { BedrockConfig } from "../adapters/bedrock.ts";

export interface BedrockScreenInput {
  candidateId: string;
  name: string;
  roleTitle: string;
  companyName?: string;
  resumeText: string;
  roleRequirements?: string[];
  transcriptText?: string;
  notes?: string;
  config?: BedrockConfig;
}

export interface BedrockScreenResult {
  candidateId: string;
  score: number;
  strengths: string[];
  concerns: string[];
  summary: string;
  recommendation: "INTERVIEW" | "SCREEN" | "HOLD" | "REJECT";
  modelId: string;
  provider: "stub" | "bedrock-converse" | "bedrock-invoke";
  degraded: boolean;
  usedFallback: boolean;
  parseOk: boolean;
  validationOk: boolean;
  parseError?: string;
  validationErrors?: string[];
  raw?: unknown;
  metrics?: BedrockFeatureResponse["metrics"];
}

function buildPromptInput(input: BedrockScreenInput): CandidateScreenPromptInput {
  return {
    candidateName: input.name,
    roleTitle: input.roleTitle,
    companyName: input.companyName,
    roleRequirements: input.roleRequirements,
    resumeText: input.resumeText,
    transcriptText: input.transcriptText,
    notes: input.notes,
  };
}

export async function runBedrockCandidateScreen(
  input: BedrockScreenInput
): Promise<BedrockScreenResult> {
  const promptBundle = buildCandidateScreenPrompt(buildPromptInput(input));

  const modelResponse = await generateStructuredJsonWithBedrock<{
    score?: number;
    strengths?: string[];
    concerns?: string[];
    summary?: string;
    recommendation?: "INTERVIEW" | "SCREEN" | "HOLD" | "REJECT" | string;
  }>(
    {
      feature: promptBundle.feature,
      system: promptBundle.system,
      prompt: promptBundle.prompt,
      schemaHint: promptBundle.schemaHint,
      config: input.config,
      metadata: {
        candidateId: input.candidateId,
        roleTitle: input.roleTitle,
      },
    },
    {
      preferConverse: true,
      maxAttempts: 3,
      logMetrics: true,
    }
  );

  // First try: parsed JSON directly from Bedrock service
  const directParsed = modelResponse.parsed;

  // Second try: raw text parser (handles markdown fences, malformed JSON wrappers)
  const textParsedResult = parseCandidateScreenText(modelResponse.text);

  // Choose the strongest available candidate shape
  const candidateValue =
    directParsed && typeof directParsed === "object"
      ? normalizeCandidateScreenLoose(directParsed)
      : textParsedResult.value;

  // Validate final shape
  const validated = validateCandidateScreen(candidateValue);

  const finalValue = validated.ok
    ? validated.data
    : normalizeCandidateScreenLoose(candidateValue);

  return {
    candidateId: input.candidateId,
    score: finalValue.score,
    strengths: finalValue.strengths,
    concerns: finalValue.concerns,
    summary: finalValue.summary,
    recommendation: finalValue.recommendation,
    modelId:
      modelResponse.modelId ||
      input.config?.modelId ||
      process.env.BEDROCK_MODEL_ID ||
      "amazon.nova-lite-v1:0",
    provider: modelResponse.provider,
    degraded: modelResponse.degraded,
    usedFallback: modelResponse.usedFallback,
    parseOk: !!directParsed || textParsedResult.ok,
    validationOk: validated.ok,
    parseError:
      modelResponse.parseError ||
      (!textParsedResult.ok ? textParsedResult.parseError : undefined),
    validationErrors: validated.ok ? undefined : validated.errors,
    raw: modelResponse.raw,
    metrics: modelResponse.metrics,
  };
}