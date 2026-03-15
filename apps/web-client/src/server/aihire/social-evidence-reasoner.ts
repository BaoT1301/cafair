import path from "node:path";

// Dynamic import so Vercel build succeeds without the agents package
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => Promise<any>;
let _runBedrockSocialEvidenceReasoner: AnyFn | null = null;
async function loadEvidenceReasoner(): Promise<AnyFn> {
  if (!_runBedrockSocialEvidenceReasoner) {
    const p = ["../../../../llm/agents/src/agents/socialEvidenceReasoner"].join("");
    const mod = await import(/* webpackIgnore: true */ p);
    _runBedrockSocialEvidenceReasoner = mod.runBedrockSocialEvidenceReasoner;
  }
  return _runBedrockSocialEvidenceReasoner!;
}

export interface GetSocialEvidenceReasonerInput {
  candidateId?: string;
  runDir?: string;
  evidencePacketPath?: string;
  roleTitle?: string;
  companyName?: string;
}

export interface GetSocialEvidenceReasonerSuccess {
  ok: true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
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

    const runBedrockSocialEvidenceReasoner = await loadEvidenceReasoner();
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

