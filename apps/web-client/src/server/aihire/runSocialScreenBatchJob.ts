// Path: apps/web-client/src/lib/aihire/runSocialScreenBatchJob.ts

import {
  getSocialScreenBatchJob,
  setSocialScreenBatchJobStatus,
  updateSocialScreenBatchCandidateResult,
  type SocialScreenBatchCandidate,
} from "@aihire/socialScreenBatchStore";

type RecruiterReadyResult = {
  fitScore: number;
  risk: "low" | "medium" | "high";
  summary: string;
  flags: string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scoreCandidate(candidate: SocialScreenBatchCandidate): RecruiterReadyResult {
  const text = `${candidate.name} ${candidate.roleTitle ?? ""} ${candidate.school ?? ""} ${candidate.resumeText ?? ""}`.toLowerCase();

  let fitScore = 55;
  const flags: string[] = [];

  if (text.includes("software")) fitScore += 10;
  if (text.includes("engineer")) fitScore += 10;
  if (text.includes("cloud")) fitScore += 8;
  if (text.includes("ai")) fitScore += 8;
  if (text.includes("full-stack")) fitScore += 6;
  if (text.includes("react")) fitScore += 5;
  if (text.includes("python")) fitScore += 5;

  if (!candidate.resumeText?.trim()) {
    flags.push("Missing resume text");
    fitScore -= 15;
  }

  if (!candidate.school?.trim()) {
    flags.push("Missing school");
    fitScore -= 5;
  }

  fitScore = Math.max(0, Math.min(100, Math.round(fitScore)));

  let risk: "low" | "medium" | "high" = "low";
  if (fitScore < 50) risk = "high";
  else if (fitScore < 70) risk = "medium";

  const summary =
    `${candidate.name} appears to be a ${candidate.roleTitle || "candidate"}`
    + `${candidate.school ? ` from ${candidate.school}` : ""}. `
    + `Initial batch screen fit score is ${fitScore}/100 with ${risk} risk.`;

  return {
    fitScore,
    risk,
    summary,
    flags,
  };
}

export async function runSocialScreenBatchJob(
  batchJobId: string,
): Promise<void> {
  const job = getSocialScreenBatchJob(batchJobId);
  if (!job) {
    throw new Error(`Batch job not found: ${batchJobId}`);
  }

  setSocialScreenBatchJobStatus(batchJobId, "running");

  for (const candidate of job.candidates) {
    try {
      updateSocialScreenBatchCandidateResult(batchJobId, candidate.candidateId, {
        status: "running",
        ok: false,
      });

      await sleep(150);

      const result = scoreCandidate(candidate);

      updateSocialScreenBatchCandidateResult(batchJobId, candidate.candidateId, {
        status: "completed",
        ok: true,
        result,
        error: undefined,
      });
    } catch (error) {
      updateSocialScreenBatchCandidateResult(batchJobId, candidate.candidateId, {
        status: "failed",
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  setSocialScreenBatchJobStatus(batchJobId, "completed");
}