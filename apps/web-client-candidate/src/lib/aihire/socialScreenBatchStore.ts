// Path: apps/web-client/src/lib/aihire/socialScreenBatchStore.ts

export type SocialScreenBatchCandidate = {
  candidateId: string;
  name: string;
  roleTitle?: string;
  school?: string;
  resumeText?: string;
};

export type SocialScreenBatchCandidateResult = {
  candidateId: string;
  name: string;
  ok: boolean;
  status: "queued" | "running" | "completed" | "failed";
  result?: {
    fitScore: number;
    risk: "low" | "medium" | "high";
    summary: string;
    flags: string[];
  };
  error?: string;
};

export type SocialScreenBatchJob = {
  batchJobId: string;
  status: "queued" | "running" | "completed" | "failed";
  totalCandidates: number;
  completedCandidates: number;
  failedCandidates: number;
  createdAt: string;
  updatedAt: string;
  candidates: SocialScreenBatchCandidate[];
  results: SocialScreenBatchCandidateResult[];
};

const batchStore = new Map<string, SocialScreenBatchJob>();

function nowIso(): string {
  return new Date().toISOString();
}

function makeBatchJobId(): string {
  return `ssb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSocialScreenBatchJob(
  candidates: SocialScreenBatchCandidate[],
): SocialScreenBatchJob {
  const batchJobId = makeBatchJobId();
  const timestamp = nowIso();

  const job: SocialScreenBatchJob = {
    batchJobId,
    status: "queued",
    totalCandidates: candidates.length,
    completedCandidates: 0,
    failedCandidates: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    candidates,
    results: candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      name: candidate.name,
      ok: false,
      status: "queued",
    })),
  };

  batchStore.set(batchJobId, job);
  return job;
}

export function getSocialScreenBatchJob(
  batchJobId: string,
): SocialScreenBatchJob | null {
  return batchStore.get(batchJobId) ?? null;
}

export function updateSocialScreenBatchJob(
  batchJobId: string,
  updater: (job: SocialScreenBatchJob) => void,
): SocialScreenBatchJob | null {
  const job = batchStore.get(batchJobId);
  if (!job) return null;

  updater(job);
  job.updatedAt = nowIso();
  batchStore.set(batchJobId, job);
  return job;
}

export function setSocialScreenBatchJobStatus(
  batchJobId: string,
  status: SocialScreenBatchJob["status"],
): SocialScreenBatchJob | null {
  return updateSocialScreenBatchJob(batchJobId, (job) => {
    job.status = status;
  });
}

export function updateSocialScreenBatchCandidateResult(
  batchJobId: string,
  candidateId: string,
  next: Partial<SocialScreenBatchCandidateResult>,
): SocialScreenBatchJob | null {
  return updateSocialScreenBatchJob(batchJobId, (job) => {
    const index = job.results.findIndex((r) => r.candidateId === candidateId);
    if (index === -1) return;

    job.results[index] = {
      ...job.results[index],
      ...next,
    };

    job.completedCandidates = job.results.filter(
      (r) => r.status === "completed",
    ).length;

    job.failedCandidates = job.results.filter(
      (r) => r.status === "failed",
    ).length;
  });
}

export function resetSocialScreenBatchJob(
  batchJobId: string,
): SocialScreenBatchJob | null {
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
