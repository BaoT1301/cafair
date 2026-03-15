import path from "node:path";
import { runBedrockSocialEvidenceReasoner } from "../../../../llm/agents/src/agents/socialEvidenceReasoner";

export interface GetSocialEvidenceReasonerInput {
  candidateId?: string;
  runDir?: string;
  evidencePacketPath?: string;
  roleTitle?: string;
  companyName?: string;
}

export interface GetSocialEvidenceReasonerSuccess {
  ok: true;
  result: Awaited<ReturnType<typeof runBedrockSocialEvidenceReasoner>>;
}

export interface GetSocialEvidenceReasonerFailure {
  ok: false;
  error: string;
  details?: string;
}

export type GetSocialEvidenceReasonerResponse =
  | GetSocialEvidenceReasonerSuccess
  | GetSocialEvidenceReasonerFailure;

function cleanText(value?: string): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export async function getSocialScreenFromEvidencePacket(
  input: GetSocialEvidenceReasonerInput,
): Promise<GetSocialEvidenceReasonerResponse> {
  try {
    const runDir = cleanText(input.runDir);
    const evidencePacketPath =
      cleanText(input.evidencePacketPath) ??
      (runDir ? path.join(runDir, "evidence_packet.json") : undefined);

    if (!evidencePacketPath) {
      return {
        ok: false,
        error: "Missing required field: runDir or evidencePacketPath",
      };
    }

    const result = await runBedrockSocialEvidenceReasoner({
      evidencePacketPath,
      candidateId: cleanText(input.candidateId),
      roleTitle: cleanText(input.roleTitle),
      companyName: cleanText(input.companyName),
    });

    return {
      ok: true,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      error: "Failed to run social evidence reasoner",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

