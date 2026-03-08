// Path: apps/llm/agents/scripts/run-social-screen-batch.ts

import fs from "node:fs";
import path from "node:path";
import {
  runSocialScreenServiceBatch,
  type SocialScreenServiceInput,
} from "../src/services/socialScreenService";

type PythonBatchCaptureCandidate = {
  candidateId: string;
  name: string;
  roleTitle?: string;
  school?: string;
  resumeText?: string;
  linkedin?: {
    url: string;
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
  } | null;
  github?: {
    url: string;
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
  } | null;
  web?: {
    queries?: string[];
    results?: Array<{
      title: string;
      snippet?: string;
      source?: string;
      url?: string;
    }>;
  } | null;
};

type PythonBatchCaptureOutput = {
  ok: boolean;
  candidates: PythonBatchCaptureCandidate[];
  meta?: Record<string, unknown>;
};

function safeReadJson(filePath: string): unknown {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Input file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from ${absolutePath}: ${
        error instanceof Error ? error.message : "Unknown parse error"
      }`,
    );
  }
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return out.length ? out : undefined;
}

function normalizeLinkedIn(value: unknown): SocialScreenServiceInput["linkedin"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const url = normalizeString(v.url);
  if (!url) return undefined;

  const experiences = Array.isArray(v.experiences)
    ? v.experiences
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const e = item as Record<string, unknown>;

          const title = normalizeString(e.title);
          const company = normalizeString(e.company);
          const start = normalizeString(e.start);

          if (!title || !company || !start) return null;

          return {
            title,
            company,
            start,
            end: normalizeString(e.end),
            description: normalizeString(e.description),
          };
        })
        .filter(Boolean) as Array<{
        title: string;
        company: string;
        start: string;
        end?: string;
        description?: string;
      }>
    : undefined;

  return {
    url,
    headline: normalizeString(v.headline),
    currentCompany: normalizeString(v.currentCompany),
    school: normalizeString(v.school),
    skills: normalizeStringArray(v.skills),
    experiences: experiences?.length ? experiences : undefined,
  };
}

function normalizeGitHub(value: unknown): SocialScreenServiceInput["github"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const url = normalizeString(v.url);
  if (!url) return undefined;

  const pinnedRepos = Array.isArray(v.pinnedRepos)
    ? v.pinnedRepos
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const r = item as Record<string, unknown>;
          const name = normalizeString(r.name);
          if (!name) return null;

          const stars =
            typeof r.stars === "number"
              ? r.stars
              : typeof r.stars === "string" && r.stars.trim()
                ? Number(r.stars)
                : undefined;

          return {
            name,
            description: normalizeString(r.description),
            language: normalizeString(r.language),
            stars: Number.isFinite(stars) ? stars : undefined,
          };
        })
        .filter(Boolean) as Array<{
        name: string;
        description?: string;
        language?: string;
        stars?: number;
      }>
    : undefined;

  const readNumber = (x: unknown): number | undefined => {
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (typeof x === "string" && x.trim()) {
      const n = Number(x);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };

  return {
    url,
    username: normalizeString(v.username),
    displayName: normalizeString(v.displayName),
    bio: normalizeString(v.bio),
    followers: readNumber(v.followers),
    following: readNumber(v.following),
    contributionsLastYear: readNumber(v.contributionsLastYear),
    pinnedRepos: pinnedRepos?.length ? pinnedRepos : undefined,
    topLanguages: normalizeStringArray(v.topLanguages),
  };
}

function normalizeWeb(value: unknown): SocialScreenServiceInput["web"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;

  const results = Array.isArray(v.results)
    ? v.results
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const r = item as Record<string, unknown>;
          const title = normalizeString(r.title);
          if (!title) return null;

          return {
            title,
            snippet: normalizeString(r.snippet),
            source: normalizeString(r.source),
            url: normalizeString(r.url),
          };
        })
        .filter(Boolean) as Array<{
        title: string;
        snippet?: string;
        source?: string;
        url?: string;
      }>
    : undefined;

  return {
    queries: normalizeStringArray(v.queries),
    results: results?.length ? results : undefined,
  };
}

function toServiceInput(candidate: PythonBatchCaptureCandidate): SocialScreenServiceInput {
  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    roleTitle: candidate.roleTitle,
    school: candidate.school,
    resumeText: candidate.resumeText,
    linkedin: normalizeLinkedIn(candidate.linkedin),
    github: normalizeGitHub(candidate.github),
    web: normalizeWeb(candidate.web),
  };
}

function assertBatchCaptureShape(data: unknown): PythonBatchCaptureOutput {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Capture JSON must be an object.");
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.candidates)) {
    throw new Error('Capture JSON must include a "candidates" array.');
  }

  const candidates: PythonBatchCaptureCandidate[] = obj.candidates.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Candidate at index ${index} must be an object.`);
    }

    const c = item as Record<string, unknown>;
    const candidateId = normalizeString(c.candidateId);
    const name = normalizeString(c.name);

    if (!candidateId) {
      throw new Error(`Candidate at index ${index} is missing candidateId.`);
    }
    if (!name) {
      throw new Error(`Candidate at index ${index} is missing name.`);
    }

    return {
      candidateId,
      name,
      roleTitle: normalizeString(c.roleTitle),
      school: normalizeString(c.school),
      resumeText: normalizeString(c.resumeText),
      linkedin: (c.linkedin ?? null) as PythonBatchCaptureCandidate["linkedin"],
      github: (c.github ?? null) as PythonBatchCaptureCandidate["github"],
      web: (c.web ?? null) as PythonBatchCaptureCandidate["web"],
    };
  });

  return {
    ok: obj.ok === true,
    candidates,
    meta:
      obj.meta && typeof obj.meta === "object" && !Array.isArray(obj.meta)
        ? (obj.meta as Record<string, unknown>)
        : undefined,
  };
}

function buildRecruiterSummary(result: Awaited<ReturnType<typeof runSocialScreenServiceBatch>>[number]) {
  if (!result.response.ok) {
    return {
      candidateId: result.candidateId,
      ok: false,
      error: result.response.error,
      details: result.response.details ?? null,
    };
  }

  const scored = result.response.result;

  return {
    candidateId: result.candidateId,
    ok: true,
    provider: result.response.provider,
    parseOk: result.response.parseOk,
    fitScore: scored.fitScore,
    socialScore: scored.socialScore,
    screenScore: scored.screenScore,
    risk: scored.risk,
    recommendation: scored.recommendation,
    summary: scored.summary,
    verifiedCount: scored.verifiedCount,
    warningCount: scored.warningCount,
    criticalCount: scored.criticalCount,
    infoCount: scored.infoCount,
    flags: scored.flags,
    recommendedActions: scored.recommendedActions,
    topFindings: scored.findings.slice(0, 5),
  };
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error(
      "Usage: npx tsx apps/llm/agents/scripts/run-social-screen-batch.ts <capture-output.json>",
    );
    process.exit(2);
  }

  const rawData = safeReadJson(inputPath);
  const parsed = assertBatchCaptureShape(rawData);

  const inputs: SocialScreenServiceInput[] = parsed.candidates.map(toServiceInput);

  const responses = await runSocialScreenServiceBatch(inputs);

  const recruiterReady = {
    ok: true,
    sourceFile: path.resolve(inputPath),
    candidateCount: responses.length,
    usedRealBedrock: process.env.USE_REAL_BEDROCK === "true",
    results: responses.map(buildRecruiterSummary),
  };

  console.log(JSON.stringify(recruiterReady, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "Failed to run social screen batch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      null,
      2,
    ),
  );
  process.exit(1);
});