// Path: apps/llm/agents/src/prompts/resumeTailor.ts
//
// Prompt builders for candidate-side resume tailoring.
// Used when the candidate agent rewrites or improves resume bullets
// for a specific role / job description.

export const RESUME_TAILOR_PROMPT_VERSION = "resume_tailor_v1";

export interface ResumeTailorPromptInput {
  candidateName: string;
  roleTitle: string;
  companyName?: string;
  currentResumeText: string;
  jobDescriptionText: string;
  candidatePreferences?: string[];
  preserveTruthfulness?: boolean; // default should be true in callers
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

export function buildResumeTailorPrompt(
  input: ResumeTailorPromptInput
): PromptBundle {
  const system = [
    "You are a career application copilot.",
    "Tailor the resume to better match the role while preserving truthfulness.",
    "Do not invent experience, projects, metrics, or tools.",
    "You may rephrase, reorder, and highlight relevant evidence already present.",
    "Return strict JSON only.",
  ].join(" ");

  const schemaHint = JSON.stringify(
    {
      summary: "string",
      matchedKeywords: ["string"],
      rewrittenBullets: ["string"],
      missingSignals: ["string"],
      cautionNotes: ["string"],
    },
    null,
    2
  );

  const prompt = [
    `Prompt Version: ${RESUME_TAILOR_PROMPT_VERSION}`,
    `Candidate Name: ${input.candidateName}`,
    `Role Title: ${input.roleTitle}`,
    `Company: ${input.companyName ?? "N/A"}`,
    `Preserve Truthfulness: ${input.preserveTruthfulness !== false ? "true" : "false"}`,
    `Candidate Preferences: ${(input.candidatePreferences ?? []).join(", ") || "N/A"}`,
    "",
    "Current Resume:",
    cleanBlock(input.currentResumeText) || "N/A",
    "",
    "Job Description:",
    cleanBlock(input.jobDescriptionText) || "N/A",
    "",
    "Task:",
    "- Identify the most relevant matched keywords from the job description.",
    "- Rewrite resume bullets to better emphasize relevant experience already present.",
    "- Do not fabricate any facts.",
    "- Point out missing signals that the candidate may need to address elsewhere.",
    "- Add caution notes if a stronger claim would require proof.",
    "- Write a short tailoring summary.",
    "",
    "Return ONLY valid JSON matching this schema:",
    schemaHint,
  ].join("\n");

  return {
    version: RESUME_TAILOR_PROMPT_VERSION,
    feature: "resume_tailor",
    system,
    prompt,
    schemaHint,
  };
}