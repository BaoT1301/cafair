// Path: apps/web-client/src/lib/aihire/runSocialScreenBatchJob.ts

import {
  getSocialScreenBatchJob,
  setSocialScreenBatchJobStatus,
  updateSocialScreenBatchCandidateResult,
} from "@/lib/aihire/socialScreenBatchStore.db";
import type { SocialScreenBatchCandidate } from "@/lib/aihire/socialScreenBatchTypes";

type RecruiterReadyResult = {
  fitScore: number;
  risk: "low" | "medium" | "high";
  summary: string;
  flags: string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scoreCandidate(
  candidate: SocialScreenBatchCandidate,
): RecruiterReadyResult {
  const text =
    `${candidate.name} ${candidate.roleTitle ?? ""} ${candidate.school ?? ""} ${candidate.resumeText ?? ""}`.toLowerCase();

  let fitScore = 55;
  const flags: string[] = [];

  if (text.includes("software")) fitScore += 10;
  if (text.includes("engineer")) fitScore += 10;
  if (text.includes("cloud")) fitScore += 8;
  if (text.includes("ai")) fitScore += 8;
  if (text.includes("full-stack")) fitScore += 6;

  if (!candidate.resumeText?.trim()) {
    flags.push("Missing resume text");
    fitScore -= 15;
  }

  fitScore = Math.max(0, Math.min(100, Math.round(fitScore)));

  let risk: "low" | "medium" | "high" = "low";
  if (fitScore < 50) risk = "high";
  else if (fitScore < 70) risk = "medium";

  return {
    fitScore,
    risk,
    summary: `${candidate.name} initial social screen fit score is ${fitScore}/100 with ${risk} risk.`,
    flags,
  };
}

export async function runSocialScreenBatchJob(
  batchJobId: string,
): Promise<void> {
  const job = await getSocialScreenBatchJob(batchJobId);

  if (!job) {
    throw new Error(`Batch job not found: ${batchJobId}`);
  }

  await setSocialScreenBatchJobStatus(batchJobId, "running");

  for (const candidate of job.candidates) {
    try {
      await updateSocialScreenBatchCandidateResult(
        batchJobId,
        candidate.candidateId,
        {
          status: "running",
          ok: false,
        },
      );

      await sleep(150);

      const result = scoreCandidate(candidate);

      await updateSocialScreenBatchCandidateResult(
        batchJobId,
        candidate.candidateId,
        {
          status: "completed",
          ok: true,
          result,
          error: undefined,
        },
      );
    } catch (error) {
      await updateSocialScreenBatchCandidateResult(
        batchJobId,
        candidate.candidateId,
        {
          status: "failed",
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      );
    }
  }

  await setSocialScreenBatchJobStatus(batchJobId, "completed");
}