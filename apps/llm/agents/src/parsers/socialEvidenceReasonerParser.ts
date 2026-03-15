import type { RecruiterSocialScreenFromEvidencePacket } from "../schema/socialEvidenceReasonerSchema.js";

export interface SocialEvidenceReasonerParseResult {
  parseOk: boolean;
  data?: RecruiterSocialScreenFromEvidencePacket;
  rawText: string;
  extractedJson?: string;
  error?: string;
}

function extractJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch?.[0]?.trim() ?? null;
}

export function parseSocialEvidenceReasonerText(
  text: string,
): SocialEvidenceReasonerParseResult {
  const rawText = text ?? "";
  const extractedJson = extractJsonBlock(rawText);

  if (!extractedJson) {
    return {
      parseOk: false,
      rawText,
      error: "No JSON object found in model output.",
    };
  }

  try {
    return {
      parseOk: true,
      data: JSON.parse(extractedJson) as RecruiterSocialScreenFromEvidencePacket,
      rawText,
      extractedJson,
    };
  } catch (error) {
    return {
      parseOk: false,
      rawText,
      extractedJson,
      error: error instanceof Error ? error.message : "JSON parse failed",
    };
  }
}

