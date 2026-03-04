// Path: apps/web-client/src/lib/aihire/matchInternshipToResume.ts

import { rankJobsByKeyword } from "@/lib/aihire/apply-agent/rankJobsByKeyword";
import type {
  ApplyAgentJob,
  RuleMatchResult,
} from "@/lib/aihire/apply-agent/types";

export function matchInternshipToResume(input: {
  resumeText: string;
  jobs: ApplyAgentJob[];
  threshold?: number;
}): {
  matches: RuleMatchResult[];
  recommendedJobs: RuleMatchResult[];
} {
  const result = rankJobsByKeyword({
    resumeText: input.resumeText,
    jobs: input.jobs,
    threshold: input.threshold,
  });

  return {
    matches: result.rankedJobs,
    recommendedJobs: result.recommendedJobs,
  };
}