// Path: apps/llm/agents/src/prompts/socialScreen.ts
//
// Prompt builder for AI Social Intelligence / Social Screen.
// Designed for a two-stage pipeline:
// 1) Nova Act (or other browser agent) captures raw LinkedIn / GitHub / Web signals
// 2) Bedrock reasons over the captured evidence and returns structured JSON
//
// This file only builds the prompt bundle. It does not call any model.

export type SocialFindingSeverity =
  | "VERIFIED"
  | "WARNING"
  | "CRITICAL"
  | "INFO";

export type SocialFindingSource = "linkedin" | "github" | "web";

export interface SocialScreenPromptFindingInput {
  source: SocialFindingSource;
  title: string;
  detail: string;
  evidence?: string;
  confidence?: number; // 0..1
}

export interface SocialScreenPromptInput {
  candidateName: string;
  roleTitle?: string;
  companyName?: string;
  school?: string;

  linkedinUrl?: string;
  githubUrl?: string;

  resumeText?: string;
  googleSummary?: string;

  // Raw captured observations from Nova Act / scraper / manual review
  rawFindings?: SocialScreenPromptFindingInput[];

  // Optional operator notes
  notes?: string;
}

export interface SocialScreenPromptBundle {
  feature: "social_screen";
  system: string;
  prompt: string;
  schemaHint: string;
}

function clean(text?: string): string {
  return (text ?? "").trim();
}

function clip01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function formatBlock(title: string, value?: string): string {
  const v = clean(value);
  return `${title}:\n${v || "N/A"}`;
}

function formatArrayBlock(title: string, items: string[]): string {
  const cleaned = items.map((x) => clean(x)).filter(Boolean);
  if (!cleaned.length) {
    return `${title}:\n- N/A`;
  }

  return `${title}:\n${cleaned.map((x) => `- ${x}`).join("\n")}`;
}

function formatRawFindings(
  findings?: SocialScreenPromptFindingInput[]
): string {
  if (!findings?.length) {
    return "Captured Findings:\n- None provided";
  }

  const lines = findings.map((f, idx) => {
    const confidence =
      typeof f.confidence === "number"
        ? ` | confidence=${clip01(f.confidence).toFixed(2)}`
        : "";

    const evidence = clean(f.evidence)
      ? ` | evidence=${clean(f.evidence)}`
      : "";

    return `- Finding ${idx + 1}: source=${f.source} | title=${clean(
      f.title
    )} | detail=${clean(f.detail)}${confidence}${evidence}`;
  });

  return `Captured Findings:\n${lines.join("\n")}`;
}

export function buildSocialScreenPrompt(
  input: SocialScreenPromptInput
): SocialScreenPromptBundle {
  const roleTitle = clean(input.roleTitle);
  const companyName = clean(input.companyName);
  const school = clean(input.school);
  const resumeText = clean(input.resumeText);
  const googleSummary = clean(input.googleSummary);
  const notes = clean(input.notes);

  const system = [
    "You are an AI recruiting copilot focused on public-signal verification.",
    "Your task is to review LinkedIn, GitHub, public web references, and resume context.",
    "Be evidence-based, conservative, and avoid inventing facts.",
    "Only use the evidence explicitly provided in the prompt.",
    "Return strict JSON only.",
    "If evidence is missing, mark it as a warning or info instead of pretending it exists.",
    "Use CRITICAL only for serious public-risk or strong contradiction signals.",
  ].join(" ");

  const schemaHint = [
    "{",
    '  "socialScore": number,',
    '  "verifiedCount": number,',
    '  "warningCount": number,',
    '  "criticalCount": number,',
    '  "infoCount": number,',
    '  "findings": [',
    "    {",
    '      "severity": "VERIFIED" | "WARNING" | "CRITICAL" | "INFO",',
    '      "source": "linkedin" | "github" | "web",',
    '      "title": string,',
    '      "detail": string,',
    '      "confidence": number',
    "    }",
    "  ],",
    '  "recommendation": string,',
    '  "summary": string',
    "}",
  ].join("\n");

  const promptSections: string[] = [
    "Candidate Social Intelligence Review",
    "",
    `Candidate Name: ${input.candidateName}`,
    `Role Title: ${roleTitle || "N/A"}`,
    `Company: ${companyName || "N/A"}`,
    `School: ${school || "N/A"}`,
    "",
    formatBlock("LinkedIn URL", input.linkedinUrl),
    "",
    formatBlock("GitHub URL", input.githubUrl),
    "",
    formatBlock("Resume Summary", resumeText),
    "",
    formatBlock("Google / Web Summary", googleSummary),
    "",
    formatRawFindings(input.rawFindings),
  ];

  if (notes) {
    promptSections.push("", formatBlock("Operator Notes", notes));
  }

  promptSections.push(
    "",
    "Instructions:",
    "1. Score the candidate's public social/professional footprint from 0 to 100.",
    "2. Count how many findings are VERIFIED, WARNING, CRITICAL, and INFO.",
    "3. Produce 4 to 12 findings total when enough evidence exists; fewer is acceptable if evidence is sparse.",
    "4. Prefer VERIFIED for strong evidence alignment, WARNING for mild concern or missing signals, INFO for neutral context, and CRITICAL only for major contradiction or serious public-risk signal.",
    "5. Keep each finding concise and recruiter-friendly.",
    "6. Write a short recommendation summarizing whether to proceed, verify further, or hold.",
    "7. Write a short summary sentence for UI display.",
    "8. Return ONLY valid JSON matching the schema.",
    "",
    "Output format:",
    schemaHint
  );

  return {
    feature: "social_screen",
    system,
    prompt: promptSections.join("\n"),
    schemaHint,
  };
}

// Optional helper for local debugging
export function buildSocialScreenPromptPreview(
  input: SocialScreenPromptInput
): string {
  const bundle = buildSocialScreenPrompt(input);

  return [
    "=== SYSTEM ===",
    bundle.system,
    "",
    "=== PROMPT ===",
    bundle.prompt,
    "",
    "=== SCHEMA HINT ===",
    bundle.schemaHint,
  ].join("\n");
}