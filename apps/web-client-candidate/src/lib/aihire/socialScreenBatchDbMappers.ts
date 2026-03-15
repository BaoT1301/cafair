// Path: apps/web-client/src/lib/aihire/socialScreenBatchDbMappers.ts

import type { SocialScreenBatchJob } from "@/lib/aihire/socialScreenBatchTypes";
import type { SocialScreenBatchJobRow } from "@/db/schema/socialScreenBatchJobs";

export function mapRowToSocialScreenBatchJob(
  row: SocialScreenBatchJobRow,
): SocialScreenBatchJob {
  return {
    batchJobId: row.batchJobId,
    status: row.status,
    totalCandidates: row.totalCandidates,
    completedCandidates: row.completedCandidates,
    failedCandidates: row.failedCandidates,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    candidates: row.candidatesJson,
    results: row.resultsJson,
  };
}