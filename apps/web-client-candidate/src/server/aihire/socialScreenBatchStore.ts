// Path: apps/web-client/src/lib/aihire/socialScreenBatchStore.ts

export type SocialScreenBatchStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type SocialScreenRisk = "low" | "medium" | "high";

export type SocialScreenBatchCandidate = {
  candidateId: string;
  name: string;
  roleTitle?: string;
  school?: string;
  resumeText?: string;
};

export type SocialScreenBatchCandidateResultData = {
  fitScore: number;
  risk: SocialScreenRisk;
  summary: string;
  flags: string[];
};

export type SocialScreenBatchCandidateResult = {
  candidateId: string;
  name: string;
  ok: boolean;
  status: SocialScreenBatchStatus;
  result?: SocialScreenBatchCandidateResultData;
  error?: string;
};

export type SocialScreenBatchJob = {
  batchJobId: string;
  status: SocialScreenBatchStatus;
  totalCandidates: number;
  completedCandidates: number;
  failedCandidates: number;
  createdAt: string;
  updatedAt: string;
  candidates: SocialScreenBatchCandidate[];
  results: SocialScreenBatchCandidateResult[];
};

declare global {
  // eslint-disable-next-line no-var
  var __aihireSocialScreenBatchStore:
    | Map<string, SocialScreenBatchJob>
    | undefined;
}

const batchStore: Map<string, SocialScreenBatchJob> =
  globalThis.__aihireSocialScreenBatchStore ??
  new Map<string, SocialScreenBatchJob>();

if (!globalThis.__aihireSocialScreenBatchStore) {
  globalThis.__aihireSocialScreenBatchStore = batchStore;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeBatchJobId(): string {
  return `ssb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeInitialCandidateResult(
  candidate: SocialScreenBatchCandidate,
): SocialScreenBatchCandidateResult {
  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    ok: false,
    status: "queued",
  };
}

function recalculateBatchCounts(job: SocialScreenBatchJob): void {
  job.completedCandidates = job.results.filter(
    (result) => result.status === "completed",
  ).length;

  job.failedCandidates = job.results.filter(
    (result) => result.status === "failed",
  ).length;
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
    candidates: [...candidates],
    results: candidates.map(makeInitialCandidateResult),
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

  if (!job) {
    return null;
  }

  updater(job);
  job.updatedAt = nowIso();

  batchStore.set(batchJobId, job);
  return job;
}

export function setSocialScreenBatchJobStatus(
  batchJobId: string,
  status: SocialScreenBatchStatus,
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
    const index = job.results.findIndex(
      (result) => result.candidateId === candidateId,
    );

    if (index === -1) {
      return;
    }

    job.results[index] = {
      ...job.results[index],
      ...next,
    };

    recalculateBatchCounts(job);
  });
}

export function resetSocialScreenBatchJob(
  batchJobId: string,
): SocialScreenBatchJob | null {
  return updateSocialScreenBatchJob(batchJobId, (job) => {
    job.status = "queued";
    job.completedCandidates = 0;
    job.failedCandidates = 0;
    job.results = job.candidates.map(makeInitialCandidateResult);
  });
}

export function listSocialScreenBatchJobs(): SocialScreenBatchJob[] {
  return Array.from(batchStore.values());
}

export function deleteSocialScreenBatchJob(batchJobId: string): boolean {
  return batchStore.delete(batchJobId);
}