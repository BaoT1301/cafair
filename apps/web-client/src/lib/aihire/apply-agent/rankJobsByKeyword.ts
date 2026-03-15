// Path: apps/web-client/src/lib/aihire/apply-agent/rankJobsByKeyword.ts

import {
  DEFAULT_TECHNICAL_KEYWORDS,
  normalizeForKeywordMatch,
} from "@/lib/aihire/technicalKeywords";
import type {
  ApplyAgentJob,
  RuleMatchResult,
} from "@/lib/aihire/apply-agent/types";

const IGNORED_TOO_SHORT_KEYWORDS = new Set([
  "r",
  "c",
]);

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shouldUseWordBoundary(keyword: string): boolean {
  return /^[a-z0-9.+#/-]+$/i.test(keyword);
}

function keywordExistsInText(text: string, keyword: string): boolean {
  const normalizedText = normalizeForKeywordMatch(text);
  const normalizedKeyword = normalizeForKeywordMatch(keyword);

  if (!normalizedKeyword) return false;
  if (IGNORED_TOO_SHORT_KEYWORDS.has(normalizedKeyword)) return false;

  // Multi-word phrases: exact normalized phrase containment is okay.
  if (normalizedKeyword.includes(" ")) {
    return normalizedText.includes(normalizedKeyword);
  }

  // For single-token keywords, use boundaries to avoid:
  // - java matching javascript
  // - api matching inside unrelated longer tokens
  const escapedKeyword = escapeRegExp(normalizedKeyword);

  if (shouldUseWordBoundary(normalizedKeyword)) {
    const pattern = new RegExp(`(^|[^a-z0-9+#./-])${escapedKeyword}([^a-z0-9+#./-]|$)`, "i");
    return pattern.test(normalizedText);
  }

  return normalizedText.includes(normalizedKeyword);
}

function findMatchedKeywords(text: string, keywords: string[]): string[] {
  const matches: string[] = [];

  for (const keyword of keywords) {
    if (keywordExistsInText(text, keyword)) {
      matches.push(normalizeForKeywordMatch(keyword));
    }
  }

  return uniqueSorted(matches);
}

function buildReason(
  job: ApplyAgentJob,
  matchedKeywords: string[],
  threshold: number,
): string {
  const companyPart = job.company ? ` at ${job.company}` : "";
  const count = matchedKeywords.length;
  const preview =
    matchedKeywords.length > 0
      ? matchedKeywords.slice(0, 8).join(", ")
      : "no strong technical overlap";

  if (count >= threshold) {
    return `${job.title}${companyPart} passed the apply threshold with ${count} matched technical keywords (${preview}).`;
  }

  return `${job.title}${companyPart} did not pass the apply threshold. It only matched ${count} technical keywords (${preview}).`;
}

function dedupeOverlappingKeywords(keywords: string[]): string[] {
  const normalized = uniqueSorted(keywords);

  // Prefer more specific variants over generic overlaps.
  const filtered = normalized.filter((keyword) => {
    if (keyword === "api" && normalized.includes("apis")) return false;
    if (keyword === "postgres" && normalized.includes("postgresql")) return false;
    if (keyword === "sql" && normalized.includes("postgresql")) return false;
    if (keyword === "java" && normalized.includes("javascript")) return false;
    return true;
  });

  return uniqueSorted(filtered);
}

export function rankJobsByKeyword(input: {
  resumeText: string;
  jobs: ApplyAgentJob[];
  threshold?: number;
}): {
  resumeKeywords: string[];
  rankedJobs: RuleMatchResult[];
  recommendedJobs: RuleMatchResult[];
} {
  const threshold =
    typeof input.threshold === "number" && input.threshold > 0
      ? Math.floor(input.threshold)
      : 3;

  const resumeKeywordHits = dedupeOverlappingKeywords(
    findMatchedKeywords(input.resumeText, DEFAULT_TECHNICAL_KEYWORDS),
  );

  const rankedJobs = input.jobs
    .map((job): RuleMatchResult => {
      const jobText = `${job.title} ${job.company ?? ""} ${job.location ?? ""} ${job.description}`;

      const jobKeywordHits = dedupeOverlappingKeywords(
        findMatchedKeywords(jobText, DEFAULT_TECHNICAL_KEYWORDS),
      );

      const matchedKeywords = dedupeOverlappingKeywords(
        resumeKeywordHits.filter((keyword) => jobKeywordHits.includes(keyword)),
      );

      const matchedKeywordCount = matchedKeywords.length;
      const shouldApply = matchedKeywordCount >= threshold;
      const keywordScore = Math.min(100, matchedKeywordCount * 10);

      return {
        ...job,
        matchedKeywords,
        matchedKeywordCount,
        shouldApply,
        keywordScore,
        reason: buildReason(job, matchedKeywords, threshold),
      };
    })
    .sort((a, b) => {
      if (b.matchedKeywordCount !== a.matchedKeywordCount) {
        return b.matchedKeywordCount - a.matchedKeywordCount;
      }
      return b.keywordScore - a.keywordScore;
    });

  return {
    resumeKeywords: resumeKeywordHits,
    rankedJobs,
    recommendedJobs: rankedJobs.filter((job) => job.shouldApply),
  };
}