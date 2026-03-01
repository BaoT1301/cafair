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
  resumeText?: string;
  notes?: string;

  linkedin?: {
    url?: string;
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

  github?: {
    url?: string;
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

  web?: {
    queries?: string[];
    results?: Array<{
      title: string;
      snippet?: string;
      source?: string;
      url?: string;
    }>;
  };

  // Optional pre-captured findings from another stage.
  rawFindings?: SocialScreenPromptFindingInput[];
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

function formatArrayBlock(title: string, items?: string[]): string {
  const cleaned = (items ?? []).map((x) => clean(x)).filter(Boolean);

  if (!cleaned.length) {
    return `${title}:\n- N/A`;
  }

  return `${title}:\n${cleaned.map((x) => `- ${x}`).join("\n")}`;
}

function formatLinkedInBlock(
  linkedin?: SocialScreenPromptInput["linkedin"],
): string {
  if (!linkedin) {
    return "LinkedIn:\n- N/A";
  }

  const lines: string[] = [];

  lines.push(`- URL: ${clean(linkedin.url) || "N/A"}`);
  lines.push(`- Headline: ${clean(linkedin.headline) || "N/A"}`);
  lines.push(`- Current Company: ${clean(linkedin.currentCompany) || "N/A"}`);
  lines.push(`- School: ${clean(linkedin.school) || "N/A"}`);

  const skills = (linkedin.skills ?? []).map((s) => clean(s)).filter(Boolean);
  lines.push(`- Skills: ${skills.length ? skills.join(", ") : "N/A"}`);

  const experiences = linkedin.experiences ?? [];
  if (experiences.length) {
    experiences.slice(0, 6).forEach((exp, idx) => {
      const title = clean(exp.title) || "N/A";
      const company = clean(exp.company) || "N/A";
      const start = clean(exp.start) || "N/A";
      const end = clean(exp.end) || "Present";
      const description = clean(exp.description);

      lines.push(
        `- Experience ${idx + 1}: ${title} @ ${company} (${start} -> ${end})${
          description ? ` | ${description}` : ""
        }`,
      );
    });
  } else {
    lines.push("- Experience: N/A");
  }

  return `LinkedIn:\n${lines.join("\n")}`;
}

function formatGitHubBlock(
  github?: SocialScreenPromptInput["github"],
): string {
  if (!github) {
    return "GitHub:\n- N/A";
  }

  const lines: string[] = [];

  lines.push(`- URL: ${clean(github.url) || "N/A"}`);
  lines.push(`- Username: ${clean(github.username) || "N/A"}`);
  lines.push(`- Display Name: ${clean(github.displayName) || "N/A"}`);
  lines.push(`- Bio: ${clean(github.bio) || "N/A"}`);
  lines.push(
    `- Followers: ${typeof github.followers === "number" ? github.followers : "N/A"}`,
  );
  lines.push(
    `- Following: ${typeof github.following === "number" ? github.following : "N/A"}`,
  );
  lines.push(
    `- Contributions Last Year: ${
      typeof github.contributionsLastYear === "number"
        ? github.contributionsLastYear
        : "N/A"
    }`,
  );

  const topLanguages = (github.topLanguages ?? [])
    .map((x) => clean(x))
    .filter(Boolean);
  lines.push(
    `- Top Languages: ${topLanguages.length ? topLanguages.join(", ") : "N/A"}`,
  );

  const repos = github.pinnedRepos ?? [];
  if (repos.length) {
    repos.slice(0, 6).forEach((repo, idx) => {
      const name = clean(repo.name) || "N/A";
      const description = clean(repo.description);
      const language = clean(repo.language) || "N/A";
      const stars =
        typeof repo.stars === "number" ? String(repo.stars) : "N/A";

      lines.push(
        `- Pinned Repo ${idx + 1}: ${name} | lang=${language} | stars=${stars}${
          description ? ` | ${description}` : ""
        }`,
      );
    });
  } else {
    lines.push("- Pinned Repos: N/A");
  }

  return `GitHub:\n${lines.join("\n")}`;
}

function formatWebBlock(web?: SocialScreenPromptInput["web"]): string {
  if (!web) {
    return "Web / Search:\n- N/A";
  }

  const lines: string[] = [];

  const queries = (web.queries ?? []).map((q) => clean(q)).filter(Boolean);
  lines.push(`- Queries: ${queries.length ? queries.join(" | ") : "N/A"}`);

  const results = web.results ?? [];
  if (results.length) {
    results.slice(0, 8).forEach((r, idx) => {
      const title = clean(r.title) || "N/A";
      const snippet = clean(r.snippet);
      const source = clean(r.source) || "N/A";
      const url = clean(r.url);

      lines.push(
        `- Result ${idx + 1}: title=${title} | source=${source}${
          snippet ? ` | snippet=${snippet}` : ""
        }${url ? ` | url=${url}` : ""}`,
      );
    });
  } else {
    lines.push("- Results: N/A");
  }

  return `Web / Search:\n${lines.join("\n")}`;
}

function formatRawFindings(
  findings?: SocialScreenPromptFindingInput[],
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
      f.title,
    )} | detail=${clean(f.detail)}${confidence}${evidence}`;
  });

  return `Captured Findings:\n${lines.join("\n")}`;
}

export function buildSocialScreenPrompt(
  input: SocialScreenPromptInput,
): SocialScreenPromptBundle {
  const roleTitle = clean(input.roleTitle);
  const companyName = clean(input.companyName);
  const school = clean(input.school);
  const resumeText = clean(input.resumeText);
  const notes = clean(input.notes);

  const system = [
    "You are an AI recruiting copilot focused on public-signal verification.",
    "Your task is to review LinkedIn, GitHub, public web references, and resume context.",
    "Be evidence-based, conservative, and do not invent facts.",
    "Only use the evidence explicitly provided in the prompt.",
    "Missing data should be treated as missing, not assumed negative.",
    "Use VERIFIED for strong evidence alignment.",
    "Use WARNING for mild concern or missing-but-useful signal.",
    "Use CRITICAL only for serious contradiction or strong public-risk evidence.",
    "Use INFO for neutral but helpful context.",
    "Return strict JSON only.",
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
    `Candidate Name: ${clean(input.candidateName) || "N/A"}`,
    `Role Title: ${roleTitle || "N/A"}`,
    `Company: ${companyName || "N/A"}`,
    `School: ${school || "N/A"}`,
    "",
    formatBlock("Resume Summary", resumeText),
    "",
    formatLinkedInBlock(input.linkedin),
    "",
    formatGitHubBlock(input.github),
    "",
    formatWebBlock(input.web),
    "",
    formatRawFindings(input.rawFindings),
    "",
    formatArrayBlock(
      "Quick Signal Checklist",
      [
        input.linkedin?.url ? "LinkedIn URL provided" : "LinkedIn URL missing",
        input.github?.url ? "GitHub URL provided" : "GitHub URL missing",
        (input.web?.results?.length ?? 0) > 0
          ? "Web search results provided"
          : "No web search results provided",
        resumeText ? "Resume summary provided" : "Resume summary missing",
      ],
    ),
  ];

  if (notes) {
    promptSections.push("", formatBlock("Operator Notes", notes));
  }

  promptSections.push(
    "",
    "Instructions:",
    "1. Score the candidate's public social/professional footprint from 0 to 100.",
    "2. Count how many findings are VERIFIED, WARNING, CRITICAL, and INFO.",
    "3. Produce 3 to 6 findings when enough evidence exists; fewer is acceptable if evidence is sparse.",
    "4. Do not claim missing LinkedIn/GitHub/Web evidence if the prompt clearly includes it.",
    "5. Prefer concise, recruiter-friendly findings tied directly to the provided evidence.",
    "6. Recommendation should state whether to proceed, verify further, or hold.",
    "7. Summary should be one short UI-friendly sentence.",
    "8. Return ONLY valid JSON matching the schema.",
    "",
    "Output format:",
    schemaHint,
  );

  return {
    feature: "social_screen",
    system,
    prompt: promptSections.join("\n"),
    schemaHint,
  };
}

export function buildSocialScreenPromptPreview(
  input: SocialScreenPromptInput,
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