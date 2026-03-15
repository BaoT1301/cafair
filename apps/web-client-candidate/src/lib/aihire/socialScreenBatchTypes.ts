// Path: apps/web-client/src/lib/aihire/socialScreenBatchTypes.ts

export type SocialScreenBatchStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

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
  status: SocialScreenBatchStatus;
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
  status: SocialScreenBatchStatus;
  totalCandidates: number;
  completedCandidates: number;
  failedCandidates: number;
  createdAt: string;
  updatedAt: string;
  candidates: SocialScreenBatchCandidate[];
  results: SocialScreenBatchCandidateResult[];
};