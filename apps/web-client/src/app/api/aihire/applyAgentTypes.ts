// Path: apps/web-client/src/lib/aihire/applyAgentTypes.ts

export type ResumeProfile = {
  rawText: string;
  normalizedText: string;
  matchedKeywords: string[];
};

export type InternshipJob = {
  id: string;
  company: string;
  role: string;
  location?: string;
  applyUrl: string;
  sourceUrl?: string;
  description: string;
};

export type InternshipMatchResult = {
  job: InternshipJob;
  matchedKeywords: string[];
  matchedCount: number;
  shouldApply: boolean;
  threshold: number;
  score: number;
  notes: string[];
};

export type ApplyAgentRunRequest = {
  jobs: InternshipJob[];
  resumeText: string;
  threshold?: number;
};

export type ApplyAgentRunResponse = {
  ok: boolean;
  totalJobs: number;
  threshold: number;
  results: InternshipMatchResult[];
};