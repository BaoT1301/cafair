// Path: apps/llm/agents/src/types.ts
//
// Shared base types for AI Hire AI / FairSignal agents.
// Keep this file focused on cross-agent foundational contracts.
// Do NOT redefine verify-specific contracts here if verify.ts is the source of truth.

export type ArtifactSource =
  | "resume"
  | "essay"
  | "transcript"
  | "portfolio"
  | "linkedin"
  | "github"
  | "google"
  | "system";

export type Lane =
  | "RECRUITER_NOW"
  | "QUICK_ASYNC_SCREEN"
  | "POLITE_REDIRECT";

export interface EvidenceItem {
  label: string;
  source: ArtifactSource;
  keyword?: string;
  quote?: string;
  scoreImpact?: number;
  url?: string;
}

export interface CandidateArtifacts {
  resumeText?: string;
  essayText?: string;
  transcriptText?: string;
  portfolioText?: string;
  linkedinText?: string;
  githubText?: string;
  googleText?: string;
}

export interface FairContext {
  fairId: string;
  boothId?: string;
  timestampISO: string;
}

export interface RoleWeights {
  keywordMatch?: number;
  mustHave?: number;
  recencySignal?: number;
}

export interface RoleThresholds {
  recruiterNow?: number;
  quickScreen?: number;
}

export interface RoleProfile {
  roleId: string;
  roleName: string;
  jobDescriptionText?: string;
  mustHaveKeywords?: string[];
  niceToHaveKeywords?: string[];
  weights?: RoleWeights;
  thresholds?: RoleThresholds;
}

export interface TriageRequest {
  candidateId: string;
  candidateName?: string;
  fair?: FairContext;
  role: RoleProfile;
  artifacts: CandidateArtifacts;
}

export interface TriageNextAction {
  action: string;
  reason: string;
}

export interface TriageDebug {
  matchedMustHave?: string[];
  matchedNiceToHave?: string[];
  missingMustHave?: string[];
  keywordScore?: number;
  mustHaveScore?: number;
  recencyScore?: number;
}

export interface TriageResult {
  candidateId: string;
  roleId: string;
  lane: Lane;
  fitScore: number;
  confidence: number;
  summary: string;
  evidence: EvidenceItem[];
  nextActions: TriageNextAction[];
  debug?: TriageDebug;
}

export interface MicroScreenScores {
  communication: number;
  roleFit: number;
  depth: number;
}

export interface MicroScreenResult {
  candidateId: string;
  roleId: string;
  scores: MicroScreenScores;
  overall: number;
  confidence: number;
  highlights: string[];
  redFlags: string[];
  followups: string[];
  evidence: EvidenceItem[];
  summary: string;
}

export interface CandidatePlanStep {
  id: string;
  title: string;
  description: string;
  tool: "nova-act" | "bedrock" | "manual";
  status: "todo" | "ready" | "blocked";
}

export interface CandidateActPlan {
  candidateId: string;
  roleId?: string;
  goal: string;
  steps: CandidatePlanStep[];
  summary: string;
}