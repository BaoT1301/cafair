import fs from "node:fs";
import { generateStructuredJsonWithBedrock } from "../../../../agents/src/services/bedrockClient";
import type { BedrockConfig } from "../../../../agents/src/adapters/bedrock";
import { parseSocialEvidenceReasonerText } from "../parsers/socialEvidenceReasonerParser.js";
import { buildSocialEvidenceReasonerPrompt } from "../prompts/socialEvidenceReasoner.js";
import {
  evidencePacketSchema,
  type EvidencePacket,
} from "../schema/evidencePacketSchema.js";
import {
  recruiterSocialScreenFromEvidencePacketSchema,
  type RecruiterSocialScreenFromEvidencePacket,
} from "../schema/socialEvidenceReasonerSchema.js";
import { buildSocialEvidenceFallbackReport } from "../services/socialEvidenceFallback.js";
import {
  applySocialEvidencePolicy,
  sanitizeCandidateId,
} from "../services/socialEvidencePolicy.js";

export interface SocialEvidenceReasonerInput {
  evidencePacketPath?: string;
  evidencePacket?: EvidencePacket;
  candidateId?: string;
  roleTitle?: string;
  companyName?: string;
  config?: BedrockConfig;
}

function truthy(value?: string): boolean {
  return value === "1" || value === "true" || value === "TRUE" || value === "yes" || value === "on";
}

function loadEvidencePacket(input: SocialEvidenceReasonerInput): EvidencePacket {
  if (input.evidencePacket) {
    return evidencePacketSchema.parse(input.evidencePacket);
  }

  const packetPath = input.evidencePacketPath;
  if (!packetPath) {
    throw new Error("Provide either evidencePacket or evidencePacketPath.");
  }
  if (!fs.existsSync(packetPath)) {
    throw new Error(`Evidence packet not found: ${packetPath}`);
  }

  const payload = JSON.parse(fs.readFileSync(packetPath, "utf-8")) as unknown;
  return evidencePacketSchema.parse(payload);
}

function shouldUseRealBedrock(): boolean {
  return truthy(process.env.USE_REAL_BEDROCK);
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text.trim().length || 1) / 4));
}

function normalizeCandidateId(value?: string): string | undefined {
  return sanitizeCandidateId(value);
}

function mergeFlags(candidateFlags: unknown, packetFlags: string[]): string[] {
  const fromCandidate = Array.isArray(candidateFlags)
    ? candidateFlags.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return [...new Set([...fromCandidate, ...packetFlags])];
}

function normalizeCitationSource(value: unknown): "linkedin" | "github" | "portfolio" | "web" | "system" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "linkedin" ||
    normalized === "github" ||
    normalized === "portfolio" ||
    normalized === "web" ||
    normalized === "system"
  ) {
    return normalized;
  }
  return undefined;
}

function normalizeCitations(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const citations = value
    .map((citation) => {
      if (!citation || typeof citation !== "object" || Array.isArray(citation)) return null;
      const record = citation as Record<string, unknown>;
      const source = normalizeCitationSource(record.source);
      if (!source) return null;
      return {
        source,
        url: typeof record.url === "string" ? record.url : undefined,
        quote: typeof record.quote === "string" ? record.quote : undefined,
        artifactPath: typeof record.artifactPath === "string" ? record.artifactPath : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return citations;
}

function normalizeReasonerCandidate(candidate: Record<string, unknown>): Record<string, unknown> {
  const verifiedFindings = Array.isArray(candidate.verifiedFindings)
    ? candidate.verifiedFindings.map((finding) => {
        if (!finding || typeof finding !== "object" || Array.isArray(finding)) return finding;
        const record = finding as Record<string, unknown>;
        return {
          ...record,
          citations: normalizeCitations(record.citations),
        };
      })
    : candidate.verifiedFindings;
  const concerns = Array.isArray(candidate.concerns)
    ? candidate.concerns.map((concern) => {
        if (!concern || typeof concern !== "object" || Array.isArray(concern)) return concern;
        const record = concern as Record<string, unknown>;
        return {
          ...record,
          citations: normalizeCitations(record.citations),
        };
      })
    : candidate.concerns;

  return {
    ...candidate,
    verifiedFindings,
    concerns,
    citations: normalizeCitations(candidate.citations),
  };
}

function safeRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export async function runBedrockSocialEvidenceReasoner(
  input: SocialEvidenceReasonerInput,
): Promise<RecruiterSocialScreenFromEvidencePacket> {
  const packet = loadEvidencePacket(input);

  if (!shouldUseRealBedrock()) {
    return applySocialEvidencePolicy(buildSocialEvidenceFallbackReport(packet, {
      candidateId: normalizeCandidateId(input.candidateId),
      provider: "deterministic-fallback",
      modelId: "deterministic-fallback",
      parseOk: false,
      validationOk: true,
      usedFallback: true,
      degraded: true,
      metrics: {
        inputTokensEstimated: estimateTokens(packet.bedrockInput.socialEvidencePacket),
        timestampISO: new Date().toISOString(),
      },
    }), packet);
  }

  const promptBundle = buildSocialEvidenceReasonerPrompt({
    evidencePacket: packet,
    roleTitle: input.roleTitle,
    companyName: input.companyName,
  });

  try {
    const llm = await generateStructuredJsonWithBedrock<RecruiterSocialScreenFromEvidencePacket>(
      {
        feature: promptBundle.feature,
        system: promptBundle.system,
        prompt: promptBundle.prompt,
        schemaHint: promptBundle.schemaHint,
        config: {
          ...input.config,
          maxTokens: input.config?.maxTokens ?? 1400,
          temperature: input.config?.temperature ?? 0.1,
        },
        metadata: {
          candidateLabel: packet.candidate.label,
          candidateId: normalizeCandidateId(input.candidateId) ?? "",
          traceMode: packet.trace.mode,
        },
      },
      {
        preferConverse: true,
        maxAttempts: 3,
        logMetrics: false,
      },
    );

    const parsedCandidate =
      llm.parsed && typeof llm.parsed === "object" && !Array.isArray(llm.parsed)
        ? llm.parsed
        : undefined;

    const parsedText = parseSocialEvidenceReasonerText(llm.text);
    const candidate = parsedCandidate ?? parsedText.data;

    if (!candidate) {
      return applySocialEvidencePolicy(buildSocialEvidenceFallbackReport(packet, {
        candidateId: normalizeCandidateId(input.candidateId),
        provider: llm.provider,
        modelId: llm.metrics.modelId,
        parseOk: false,
        validationOk: false,
        usedFallback: true,
        degraded: true,
        metrics: llm.metrics,
      }), packet);
    }

    const normalized = recruiterSocialScreenFromEvidencePacketSchema.parse({
      ...normalizeReasonerCandidate(candidate as Record<string, unknown>),
      candidateId: normalizeCandidateId(candidate.candidateId ?? input.candidateId),
      candidateLabel: candidate.candidateLabel ?? packet.candidate.label,
      flags: mergeFlags(candidate.flags, packet.flags),
      stageStatus: candidate.stageStatus ?? packet.stageStatus,
      provider: llm.provider,
      modelId: llm.metrics.modelId,
      parseOk: true,
      validationOk: true,
      usedFallback: false,
      degraded: llm.degraded,
      metrics: {
        latencyMs: llm.metrics.latencyMs,
        attempts: llm.metrics.attempts,
        inputTokensEstimated: llm.metrics.inputTokensEstimated,
        outputTokensEstimated: llm.metrics.outputTokensEstimated,
        timestampISO: llm.metrics.timestampISO,
        requestId: safeRequestId(llm.metrics.requestId),
      },
    });

    return applySocialEvidencePolicy(normalized, packet);
  } catch (error) {
    return applySocialEvidencePolicy(buildSocialEvidenceFallbackReport(packet, {
      candidateId: normalizeCandidateId(input.candidateId),
      provider: "deterministic-fallback",
      modelId: input.config?.modelId ?? process.env.BEDROCK_MODEL_ID ?? "deterministic-fallback",
      parseOk: false,
      validationOk: true,
      usedFallback: true,
      degraded: true,
      metrics: {
        inputTokensEstimated: estimateTokens(packet.bedrockInput.socialEvidencePacket),
        timestampISO: new Date().toISOString(),
        requestId: "local",
      },
    }), packet);
  }
}
