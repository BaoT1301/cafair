// Path: apps/llm/agents/src/services/socialScreenService.ts
//
// Service wrapper for AI Social Intelligence / Social Screen.
// Purpose:
// - provide one stable entrypoint for social screening
// - support fast local stub/demo mode
// - optionally use Bedrock for reasoning/summary enrichment
// - normalize final output for recruiter UI
//
// Depends on:
// - ../agents/socialScreen
// - ../prompts/socialScreen
// - ../parsers/socialScreenParser
// - ./bedrockClient
//
// Notes:
// - This file does NOT run Nova Act itself.
// - Nova Act should gather/capture LinkedIn/GitHub/Web data first.
// - Then pass the collected signals into this service.

import {
  runSocialScreen,
  type SocialScreenInput,
  type SocialScreenResult,
  type SocialRisk,
} from "../agents/socialScreen";
import {
  buildSocialScreenPrompt,
  type SocialScreenPromptInput,
} from "../prompts/socialScreen";
import { parseSocialScreenText } from "../parsers/socialScreenParser";
import {
  generateStructuredJsonWithBedrock,
  type BedrockFeatureResponse,
} from "./bedrockClient";
import type { BedrockConfig } from "../adapters/bedrock";

type LinkedInSignalInputLike = {
  url: string;
  headline?: string;
  currentCompany?: string;
  school?: string;
  skills?: string[];
  experiences?: Array<{
    title: string;
    company: string;
    start: string;
    end?: string;
    description?: string;
  }>;
};

type GitHubSignalInputLike = {
  url: string;
  username?: string;
  displayName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  contributionsLastYear?: number;
  pinnedRepos?: Array<{
    name: string;
    description?: string;
    language?: string;
    stars?: number;
  }>;
  topLanguages?: string[];
};

type WebSignalInputLike = {
  queries?: string[];
  results?: Array<{
    title: string;
    snippet?: string;
    source?: string;
    url?: string;
  }>;
};

export interface SocialScreenServiceInput extends SocialScreenInput {
  linkedin?: LinkedInSignalInputLike;
  github?: GitHubSignalInputLike;
  web?: WebSignalInputLike;
  config?: BedrockConfig;
  useBedrock?: boolean;
}

export interface SocialScreenServiceResult {
  ok: true;
  result: SocialScreenResult;
  provider: "local-social-screen" | "bedrock-social-screen";
  parseOk: boolean;
  degraded: boolean;
  usedFallback: boolean;
  raw?: unknown;
  metrics?: BedrockFeatureResponse["metrics"];
}

export interface SocialScreenServiceFailure {
  ok: false;
  error: string;
  details?: string;
}

export type SocialScreenServiceResponse =
  | SocialScreenServiceResult
  | SocialScreenServiceFailure;

type LlmSocialPatch = Partial<{
  fitScore: number;
  risk: SocialRisk;
  strengths: string[];
  concerns: string[];
  flags: string[];
  summary: string;
}>;

function truthy(v?: string): boolean {
  return (
    v === "1" ||
    v === "true" ||
    v === "TRUE" ||
    v === "yes" ||
    v === "on"
  );
}

function clampScore(n: unknown, fallback: number): number {
  const value = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanText(s?: string): string {
  return (s ?? "").trim();
}

function uniqStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function normalizeRisk(value: unknown): SocialRisk {
  const v = String(value ?? "").trim().toLowerCase();

  if (v === "high") return "high";
  if (v === "medium") return "medium";
  return "low";
}

function shouldUseBedrock(input: SocialScreenServiceInput): boolean {
  if (typeof input.useBedrock === "boolean") return input.useBedrock;
  return truthy(process.env.USE_REAL_BEDROCK);
}

function toPromptInput(input: SocialScreenServiceInput): SocialScreenPromptInput {
  const promptInput: SocialScreenPromptInput = {
    candidateName: input.name,
    roleTitle: input.roleTitle,
    school: input.school,
    resumeText: input.resumeText,
  };

  // These fields assume your updated prompt type supports them.
  // Cast keeps this service compiling even if the imported prompt type
  // lags temporarily behind the prompt implementation.
  return {
    ...promptInput,
    linkedin: input.linkedin,
    github: input.github,
    web: input.web,
  } as SocialScreenPromptInput;
}

function mergeLlmIntoBase(
  base: SocialScreenResult,
  llmValue: LlmSocialPatch,
): SocialScreenResult {
  const strengths = uniqStrings(llmValue.strengths);
  const concerns = uniqStrings(llmValue.concerns);
  const llmFlags = uniqStrings(llmValue.flags);

  const mergedFlags = Array.from(
    new Set([...(base.flags ?? []), ...llmFlags]),
  );

  const risk: SocialRisk =
    llmValue.risk !== undefined ? normalizeRisk(llmValue.risk) : base.risk;

  const summary =
    cleanText(llmValue.summary) ||
    (strengths.length || concerns.length
      ? [
          strengths.length
            ? `Strengths: ${strengths.slice(0, 2).join("; ")}.`
            : "",
          concerns.length
            ? `Concerns: ${concerns.slice(0, 2).join("; ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      : base.summary);

  const fitScore = clampScore(llmValue.fitScore, base.fitScore);

  const screenScore = Math.max(
    0,
    Math.min(40, Math.round((fitScore / 100) * 40)),
  );

  return {
    ...base,
    fitScore,
    screenScore,
    risk,
    flags: mergedFlags,
    summary,
  };
}

export async function runSocialScreenService(
  input: SocialScreenServiceInput,
): Promise<SocialScreenServiceResponse> {
  try {
    const base = await Promise.resolve(runSocialScreen(input));

    if (!shouldUseBedrock(input)) {
      return {
        ok: true,
        result: base,
        provider: "local-social-screen",
        parseOk: true,
        degraded: false,
        usedFallback: false,
      };
    }

    const promptBundle = buildSocialScreenPrompt(toPromptInput(input));

    const llm = await generateStructuredJsonWithBedrock<{
      fitScore?: number;
      risk?: SocialRisk | string;
      strengths?: string[];
      concerns?: string[];
      flags?: string[];
      summary?: string;
    }>(
      {
        feature: promptBundle.feature,
        system: promptBundle.system,
        prompt: promptBundle.prompt,
        schemaHint: promptBundle.schemaHint,
        config: {
          ...input.config,
          maxTokens: input.config?.maxTokens ?? 900,
        },
        metadata: {
          candidateId: input.candidateId,
          roleTitle: input.roleTitle ?? "N/A",
        },
      },
      {
        preferConverse: true,
        maxAttempts: 3,
        logMetrics: true,
      },
    );

    let parsedValue: LlmSocialPatch | null = null;
    let parseOk = false;

    if (
      llm.parsed &&
      typeof llm.parsed === "object" &&
      !Array.isArray(llm.parsed)
    ) {
      const candidate = llm.parsed as {
        fitScore?: number;
        risk?: unknown;
        strengths?: unknown;
        concerns?: unknown;
        flags?: unknown;
        summary?: unknown;
      };

      parsedValue = {
        fitScore: candidate.fitScore,
        risk:
          candidate.risk !== undefined
            ? normalizeRisk(candidate.risk)
            : undefined,
        strengths: uniqStrings(candidate.strengths),
        concerns: uniqStrings(candidate.concerns),
        flags: uniqStrings(candidate.flags),
        summary:
          typeof candidate.summary === "string"
            ? cleanText(candidate.summary)
            : undefined,
      };

      parseOk = true;
    } else {
      const parsedText = parseSocialScreenText(llm.text);

      if (parsedText.ok) {
        parsedValue = {
          fitScore: parsedText.value.fitScore,
          risk: parsedText.value.risk,
          strengths: parsedText.value.strengths,
          concerns: parsedText.value.concerns,
          flags: parsedText.value.flags,
          summary: parsedText.value.summary,
        };
        parseOk = true;
      }
    }

    const finalResult = parsedValue
      ? mergeLlmIntoBase(base, parsedValue)
      : base;

    return {
      ok: true,
      result: finalResult,
      provider: "bedrock-social-screen",
      parseOk,
      degraded: llm.degraded,
      usedFallback: llm.usedFallback,
      raw: llm.raw,
      metrics: llm.metrics,
    };
  } catch (error) {
    return {
      ok: false,
      error: "Failed to run social screen service",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}