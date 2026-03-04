import type {
  BedrockRankedJob,
  RuleMatchResult,
} from "@/lib/aihire/apply-agent/types";

type RerankInput = {
  resumeText: string;
  jobs: RuleMatchResult[];
  threshold?: number;
};

type BedrockStructuredScore = {
  jobId: string;
  aiScore: number;
  aiReason: string;
  recommended: boolean;
};

const DEFAULT_BEDROCK_MODEL_ID =
  process.env.APPLY_AGENT_BEDROCK_MODEL_ID ||
  process.env.BEDROCK_MODEL_ID ||
  "amazon.nova-lite-v1:0";

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildHeuristicReason(
  job: RuleMatchResult,
  recommended: boolean,
  signals: string[],
): string {
  const signalText =
    signals.length > 0
      ? signals.slice(0, 4).join(", ")
      : "general technical overlap";

  if (recommended) {
    return `AI reranker sees strong overlap for ${job.title} based on ${signalText}.`;
  }

  return `AI reranker does not see enough overlap for ${job.title}; strongest signals were ${signalText}.`;
}

function heuristicRerank(
  input: RerankInput,
  threshold: number,
): BedrockRankedJob[] {
  const ranked = input.jobs.map((job): BedrockRankedJob => {
    const lowerTitle = job.title.toLowerCase();
    const lowerDescription = job.description.toLowerCase();
    const lowerResume = input.resumeText.toLowerCase();

    let bonus = 0;
    const signals: string[] = [...job.matchedKeywords];

    if (lowerTitle.includes("software engineer")) bonus += 12;
    if (lowerTitle.includes("software")) bonus += 8;
    if (lowerTitle.includes("ai")) bonus += 10;
    if (lowerTitle.includes("ml")) bonus += 8;
    if (lowerTitle.includes("machine learning")) bonus += 10;
    if (lowerTitle.includes("data")) bonus += 6;
    if (lowerTitle.includes("backend")) bonus += 5;
    if (lowerTitle.includes("full stack")) bonus += 5;
    if (lowerTitle.includes("automation")) bonus += 8;

    if (lowerDescription.includes("bedrock") && lowerResume.includes("bedrock")) {
      bonus += 8;
      signals.push("bedrock");
    }

    if (lowerDescription.includes("react") && lowerResume.includes("react")) {
      bonus += 5;
      signals.push("react");
    }

    if (lowerDescription.includes("next.js") && lowerResume.includes("next.js")) {
      bonus += 5;
      signals.push("next.js");
    }

    if (
      lowerDescription.includes("typescript") &&
      lowerResume.includes("typescript")
    ) {
      bonus += 5;
      signals.push("typescript");
    }

    if (lowerDescription.includes("python") && lowerResume.includes("python")) {
      bonus += 5;
      signals.push("python");
    }

    if (lowerDescription.includes("aws") && lowerResume.includes("aws")) {
      bonus += 6;
      signals.push("aws");
    }

    if (lowerDescription.includes("remote")) {
      bonus += 3;
      signals.push("remote");
    }

    const aiScore = clampScore(job.keywordScore + bonus);
    const recommended =
      aiScore >= threshold * 10 || job.matchedKeywordCount >= threshold;

    return {
      ...job,
      aiScore,
      aiReason: buildHeuristicReason(job, recommended, signals),
      recommended,
    };
  });

  ranked.sort((a, b) => {
    if (b.aiScore !== a.aiScore) return b.aiScore - a.aiScore;
    if (b.matchedKeywordCount !== a.matchedKeywordCount) {
      return b.matchedKeywordCount - a.matchedKeywordCount;
    }
    return b.keywordScore - a.keywordScore;
  });

  return ranked;
}

function shouldUseRealBedrock(): boolean {
  return Boolean(
    process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY,
  );
}

function buildBedrockPrompt(input: RerankInput, threshold: number): string {
  const compactJobs = input.jobs.map((job) => ({
    jobId: job.jobId,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    description: job.description,
    matchedKeywords: job.matchedKeywords,
    matchedKeywordCount: job.matchedKeywordCount,
    keywordScore: job.keywordScore,
    keywordReason: job.reason,
  }));

  return [
    "You are an AI job-fit reranker for an internship auto-apply agent.",
    "Given a resume and pre-filtered jobs, produce a stricter ranking.",
    "Return ONLY valid JSON as an array.",
    "Each array item must contain:",
    '{ "jobId": string, "aiScore": number, "aiReason": string, "recommended": boolean }',
    "",
    `Apply threshold: ${threshold}`,
    "",
    "Scoring guidance:",
    "- Score 0 to 100.",
    "- Prefer strong technical alignment, internship fit, and likely resume relevance.",
    "- Use matched keywords as one signal, but also infer semantic fit.",
    "- Mark recommended=true only when the role is worth applying to.",
    "- Keep aiReason concise and specific.",
    "",
    `Resume:\n${normalizeWhitespace(input.resumeText)}`,
    "",
    `Jobs:\n${JSON.stringify(compactJobs, null, 2)}`,
  ].join("\n");
}

function extractJsonArray(text: string): BedrockStructuredScore[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  const raw = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        jobId: typeof item.jobId === "string" ? item.jobId : "",
        aiScore: clampScore(
          typeof item.aiScore === "number"
            ? item.aiScore
            : Number(item.aiScore ?? 0),
        ),
        aiReason:
          typeof item.aiReason === "string" && item.aiReason.trim()
            ? item.aiReason.trim()
            : "Bedrock reranker returned no explanation.",
        recommended: Boolean(item.recommended),
      }))
      .filter((item) => item.jobId);
  } catch {
    return null;
  }
}

async function invokeBedrockText(prompt: string): Promise<string> {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS Bedrock credentials in environment.");
  }

  const awsSdk = await import("@aws-sdk/client-bedrock-runtime");
  const { BedrockRuntimeClient, ConverseCommand } = awsSdk;

  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    },
  });

  const command = new ConverseCommand({
    modelId: DEFAULT_BEDROCK_MODEL_ID,
    messages: [
      {
        role: "user",
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 1200,
      temperature: 0.2,
      topP: 0.9,
    },
  });

  const response = await client.send(command);

  const text =
    response.output?.message?.content
      ?.map((block) => ("text" in block && block.text ? block.text : ""))
      .join("\n")
      .trim() || "";

  if (!text) {
    throw new Error("Empty response from Bedrock reranker.");
  }

  return text;
}

async function tryRealBedrockRerank(
  input: RerankInput,
  threshold: number,
): Promise<BedrockRankedJob[] | null> {
  try {
    const prompt = buildBedrockPrompt(input, threshold);
    const rawText = await invokeBedrockText(prompt);
    const parsed = extractJsonArray(rawText);

    if (!parsed || parsed.length === 0) {
      return null;
    }

    const byJobId = new Map(parsed.map((item) => [item.jobId, item]));

    const ranked: BedrockRankedJob[] = input.jobs.map((job) => {
      const modelResult = byJobId.get(job.jobId);

      if (!modelResult) {
        const fallbackRecommended = job.matchedKeywordCount >= threshold;

        return {
          ...job,
          aiScore: clampScore(job.keywordScore),
          aiReason: fallbackRecommended
            ? "Bedrock did not score this job explicitly, so keyword score was used."
            : "Bedrock did not score this job explicitly, and keyword overlap was limited.",
          recommended: fallbackRecommended,
        };
      }

      return {
        ...job,
        aiScore: clampScore(modelResult.aiScore),
        aiReason: modelResult.aiReason,
        recommended: modelResult.recommended,
      };
    });

    ranked.sort((a, b) => {
      if (b.aiScore !== a.aiScore) return b.aiScore - a.aiScore;
      if (b.matchedKeywordCount !== a.matchedKeywordCount) {
        return b.matchedKeywordCount - a.matchedKeywordCount;
      }
      return b.keywordScore - a.keywordScore;
    });

    return ranked;
  } catch (error) {
    console.error("rerankJobsWithBedrock: real Bedrock rerank failed:", error);
    return null;
  }
}

export async function rerankJobsWithBedrock(
  input: RerankInput,
): Promise<BedrockRankedJob[]> {
  const threshold =
    typeof input.threshold === "number" && input.threshold > 0
      ? Math.floor(input.threshold)
      : 3;

  if (!Array.isArray(input.jobs) || input.jobs.length === 0) {
    return [];
  }

  if (shouldUseRealBedrock()) {
    const bedrockRanked = await tryRealBedrockRerank(input, threshold);
    if (bedrockRanked) {
      return bedrockRanked;
    }
  }

  return heuristicRerank(input, threshold);
}