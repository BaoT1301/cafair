// Path: apps/llm/agents/src/prompts/candidateScreen.ts
//
// Prompt builders for recruiter-side candidate screening.
// These helpers keep prompt text versioned, reusable, and easier to maintain.

export const CANDIDATE_SCREEN_PROMPT_VERSION = "candidate_screen_v1";

export interface CandidateScreenPromptInput {
  candidateName: string;
  roleTitle: string;
  companyName?: string;
  roleRequirements?: string[];
  resumeText: string;
  transcriptText?: string;
  notes?: string;
}

export interface PromptBundle {
  version: string;
  feature: string;
  system: string;
  prompt: string;
  schemaHint: string;
}

function cleanBlock(text?: string): string {
  return (text ?? "").trim();
}

export function buildCandidateScreenPrompt(
  input: CandidateScreenPromptInput
): PromptBundle {
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
    2
  );

  const prompt = [
    `Prompt Version: ${CANDIDATE_SCREEN_PROMPT_VERSION}`,
    `Candidate Name: ${input.candidateName}`,
    `Role Title: ${input.roleTitle}`,
    `Company: ${input.companyName ?? "N/A"}`,
    `Role Requirements: ${(input.roleRequirements ?? []).join(", ") || "N/A"}`,
    "",
    "Resume:",
    cleanBlock(input.resumeText) || "N/A",
    "",
    "Optional Transcript / Conversation Notes:",
    cleanBlock(input.transcriptText) || "N/A",
    "",
    "Additional Recruiter Notes:",
    cleanBlock(input.notes) || "N/A",
    "",
    "Task:",
    "- Score overall fit from 0 to 100.",
    "- List the strongest evidence-backed strengths.",
    "- List concrete concerns or missing proof.",
    "- Give a short summary.",
    "- Recommend one next stage.",
    "",
    "Return ONLY valid JSON matching this schema:",
    schemaHint,
  ].join("\n");

  return {
    version: CANDIDATE_SCREEN_PROMPT_VERSION,
    feature: "candidate_screen",
    system,
    prompt,
    schemaHint,
  };
}