// Path: apps/web-client/src/server/aihire/bedrock.ts
//
// App-facing Bedrock wrapper for recruiter-side screening.
// This is the stable backend layer your teammate should call from procedures/routes.
//
// It wraps:
//   agents/src/agents/bedrockScreen.ts -> runBedrockCandidateScreen(...)
//
// Returns a simple app-safe shape:
//   { ok: true, result }
// or
//   { ok: false, error, details? }

// Dynamic import so Vercel build succeeds without the agents package
type RunBedrockCandidateScreen = typeof import("../../../../agents/src/agents/bedrockScreen").runBedrockCandidateScreen;
let _runBedrockCandidateScreen: RunBedrockCandidateScreen | null = null;
async function loadBedrockAgent(): Promise<RunBedrockCandidateScreen> {
  if (!_runBedrockCandidateScreen) {
    try {
      const mod = await import("../../../../agents/src/agents/bedrockScreen");
      _runBedrockCandidateScreen = mod.runBedrockCandidateScreen;
    } catch {
      throw new Error("Bedrock agent package not available in this environment");
    }
  }
  return _runBedrockCandidateScreen;
}

export interface GetBedrockScreenInput {
  candidateId: string;
  name: string;
  roleTitle: string;
  companyName?: string;
  resumeText: string;
  roleRequirements?: string[];
  transcriptText?: string;
  notes?: string;
}

export interface GetBedrockScreenSuccess {
  ok: true;
  result: unknown;
}

export interface GetBedrockScreenFailure {
  ok: false;
  error: string;
  details?: string;
}

export type GetBedrockScreenResponse =
  | GetBedrockScreenSuccess
  | GetBedrockScreenFailure;

function assertRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required field: ${field}`);
  }
}

function normalizeInput(input: GetBedrockScreenInput): GetBedrockScreenInput {
  assertRequiredString(input.candidateId, "candidateId");
  assertRequiredString(input.name, "name");
  assertRequiredString(input.roleTitle, "roleTitle");
  assertRequiredString(input.resumeText, "resumeText");

  return {
    candidateId: input.candidateId.trim(),
    name: input.name.trim(),
    roleTitle: input.roleTitle.trim(),
    companyName: input.companyName?.trim() || undefined,
    resumeText: input.resumeText.trim(),
    roleRequirements: Array.isArray(input.roleRequirements)
      ? input.roleRequirements
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter(Boolean)
      : undefined,
    transcriptText: input.transcriptText?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  };
}

export async function getBedrockScreen(
  input: GetBedrockScreenInput,
): Promise<GetBedrockScreenResponse> {
  try {
    const normalized = normalizeInput(input);

    const runBedrockCandidateScreen = await loadBedrockAgent();
    const result = await runBedrockCandidateScreen({
      candidateId: normalized.candidateId,
      name: normalized.name,
      roleTitle: normalized.roleTitle,
      companyName: normalized.companyName,
      resumeText: normalized.resumeText,
      roleRequirements: normalized.roleRequirements,
      transcriptText: normalized.transcriptText,
      notes: normalized.notes,
    });

    return {
      ok: true,
      result,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Bedrock screen error";

    return {
      ok: false,
      error: "Failed to run Bedrock recruiter screen",
      details: message,
    };
  }
}
