import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialScreenBatchJobs } from "@/db/schema/socialScreenBatchJobs";
import type {
  SocialScreenBatchCandidate,
  SocialScreenBatchCandidateResult,
  SocialScreenBatchJob,
} from "@/lib/aihire/socialScreenBatchTypes";
import { mapRowToSocialScreenBatchJob } from "@/lib/aihire/socialScreenBatchDbMappers";

function makeBatchJobId(): string {
  return `ssb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createSocialScreenBatchJob(
  candidates: SocialScreenBatchCandidate[],
): Promise<SocialScreenBatchJob> {
  const batchJobId = makeBatchJobId();

  const results: SocialScreenBatchCandidateResult[] = candidates.map(
    (candidate) => ({
      candidateId: candidate.candidateId,
      name: candidate.name,
      ok: false,
      status: "queued",
    }),
  );

  const [row] = await db
    .insert(socialScreenBatchJobs)
    .values({
      batchJobId,
      status: "queued",
      totalCandidates: candidates.length,
      completedCandidates: 0,
      failedCandidates: 0,
      candidatesJson: candidates,
      resultsJson: results,
    })
    .returning();

  return mapRowToSocialScreenBatchJob(row);
}

export async function getSocialScreenBatchJob(
  batchJobId: string,
): Promise<SocialScreenBatchJob | null> {
  const rows = await db
    .select()
    .from(socialScreenBatchJobs)
    .where(eq(socialScreenBatchJobs.batchJobId, batchJobId))
    .limit(1);

  const row = rows[0] ?? null;

  if (!row) return null;
  return mapRowToSocialScreenBatchJob(row);
}

export async function updateSocialScreenBatchJob(
  batchJobId: string,
  updater: (job: SocialScreenBatchJob) => void,
): Promise<SocialScreenBatchJob | null> {
  const existingJob = await getSocialScreenBatchJob(batchJobId);

  if (!existingJob) {
    return null;
  }

  const nextJob: SocialScreenBatchJob = {
    ...existingJob,
    candidates: [...existingJob.candidates],
    results: existingJob.results.map((result) => ({ ...result })),
  };

  updater(nextJob);

  const [row] = await db
    .update(socialScreenBatchJobs)
    .set({
      status: nextJob.status,
      totalCandidates: nextJob.totalCandidates,
      completedCandidates: nextJob.completedCandidates,
      failedCandidates: nextJob.failedCandidates,
      candidatesJson: nextJob.candidates,
      resultsJson: nextJob.results,
      updatedAt: new Date(),
    })
    .where(eq(socialScreenBatchJobs.batchJobId, batchJobId))
    .returning();

  if (!row) {
    return null;
  }

  return mapRowToSocialScreenBatchJob(row);
}

export async function setSocialScreenBatchJobStatus(
  batchJobId: string,
  status: SocialScreenBatchJob["status"],
): Promise<SocialScreenBatchJob | null> {
  return updateSocialScreenBatchJob(batchJobId, (job) => {
    job.status = status;
  });
}

export async function updateSocialScreenBatchCandidateResult(
  batchJobId: string,
  candidateId: string,
  next: Partial<SocialScreenBatchCandidateResult>,
): Promise<SocialScreenBatchJob | null> {
  return updateSocialScreenBatchJob(batchJobId, (job) => {
    const index = job.results.findIndex((result) => result.candidateId === candidateId);

    if (index === -1) {
      return;
    }

    job.results[index] = {
      ...job.results[index],
      ...next,
    };

    job.completedCandidates = job.results.filter(
      (result) => result.status === "completed",
    ).length;

    job.failedCandidates = job.results.filter(
      (result) => result.status === "failed",
    ).length;
  });
}

export async function resetSocialScreenBatchJob(
  batchJobId: string,
): Promise<SocialScreenBatchJob | null> {
  return updateSocialScreenBatchJob(batchJobId, (job) => {
    job.status = "queued";
    job.completedCandidates = 0;
    job.failedCandidates = 0;
    job.results = job.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      name: candidate.name,
      ok: false,
      status: "queued",
    }));
  });
}