export type SocialScreenRunMode = "nova" | "deterministic" | "replay" | "demo";

export type SocialScreenStage =
  | "linkedin"
  | "github"
  | "portfolio"
  | "web"
  | "capture"
  | "reasoner";

export type SocialScreenSeverity = "info" | "warning" | "critical";

export type SocialScreenCitationSource =
  | "linkedin"
  | "github"
  | "portfolio"
  | "web"
  | "system";

export interface SocialScreenCitation {
  source: SocialScreenCitationSource;
  url?: string;
  quote?: string;
  artifactPath?: string;
}

export interface SocialScreenRunRequest {
  candidateId?: string;
  candidateLabel: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  webQueries?: string[];
  mode?: SocialScreenRunMode;
  replayRunDir?: string;
  roleTitle?: string;
  companyName?: string;
  localBrowser?: boolean;
  manualLinkedinLogin?: boolean;
  traceRedact?: "full" | "partial" | "off";
  useRealBedrock?: boolean;
}

export interface SocialScreenRunResponse {
  ok: true;
  runId: string;
  runDir: string;
  streamUrl: string;
  reportUrl: string;
  status: "queued" | "running" | "completed" | "failed";
}

export interface SocialScreenStatusResponse {
  ok: true;
  runId: string;
  status: "queued" | "running" | "completed" | "failed";
  updatedAtISO?: string;
  startedAtISO?: string;
  finishedAtISO?: string;
  runDir?: string;
  stageStatus?: {
    linkedin: string;
    github: string;
    portfolio: string;
    web: string;
  };
} 

export interface SocialScreenReportResponse {
  ok: boolean;
  runId?: string;
  status?: "queued" | "running" | "completed" | "failed";
  report?: Record<string, unknown>;
  error?: string;
  candidate?: string;
}

export interface SocialScreenStreamEventBase {
  eventId: string;
  timestampISO: string;
}

export interface SocialScreenStatusEvent extends SocialScreenStreamEventBase {
  type: "status";
  stage?: SocialScreenStage;
  phase?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface SocialScreenFindingEvent extends SocialScreenStreamEventBase {
  type: "finding";
  stage?: SocialScreenStage;
  message: string;
  data: {
    severity: SocialScreenSeverity;
    text?: string;
    title?: string;
    citations?: SocialScreenCitation[];
  };
}

export interface SocialScreenLogEvent extends SocialScreenStreamEventBase {
  type: "log";
  stage?: SocialScreenStage;
  message: string;
  data?: Record<string, unknown>;
}

export interface SocialScreenErrorEvent extends SocialScreenStreamEventBase {
  type: "error";
  stage?: SocialScreenStage;
  phase?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface SocialScreenDoneEvent extends SocialScreenStreamEventBase {
  type: "done";
  stage?: SocialScreenStage;
  phase?: string;
  message: string;
  data: {
    risk: string;
    recommendation: string;
    flags?: string[];
    reportPath?: string;
  };
}

export interface SocialScreenPingEvent extends SocialScreenStreamEventBase {
  type: "ping";
  message: "heartbeat";
  data: {
    nowISO: string;
  };
}

export type SocialScreenStreamEvent =
  | SocialScreenStatusEvent
  | SocialScreenFindingEvent
  | SocialScreenLogEvent
  | SocialScreenErrorEvent
  | SocialScreenDoneEvent
  | SocialScreenPingEvent;
