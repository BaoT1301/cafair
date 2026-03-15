// Path: apps/web-client/src/lib/aihire/apply-agent/types.ts

export type ApplyAgentJob = {
  jobId: string;
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  description: string;
  source: "simplify" | "serpapi";
};

export type RuleMatchResult = {
  jobId: string;
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  description: string;
  source: "simplify" | "serpapi";
  matchedKeywords: string[];
  matchedKeywordCount: number;
  shouldApply: boolean;
  keywordScore: number;
  reason: string;
};

export type BedrockRankedJob = RuleMatchResult & {
  aiScore: number;
  aiReason: string;
  recommended: boolean;
};

export type ScanPipelineResult = {
  sourceJobs: ApplyAgentJob[];
  keywordShortlist: RuleMatchResult[];
  aiRankedJobs: BedrockRankedJob[];
  fallbackUsed: boolean;
};