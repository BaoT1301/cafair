export type SocialFindingSeverity = "VERIFIED" | "WARNING" | "CRITICAL" | "INFO";
export type SocialFindingSource = "linkedin" | "github" | "web";

export interface SocialFinding {
  severity: SocialFindingSeverity;
  source: SocialFindingSource;
  title: string;
  detail: string;
  confidence: number; // 0..1
}

export interface GitHubPinnedRepo {
  name: string;
  description?: string;
  language?: string;
  stars?: number;
}

export interface GitHubRawCapture {
  url: string;
  username?: string;
  displayName?: string;
  bio?: string;
  location?: string;
  followers?: number;
  following?: number;
  contributionsLastYear?: number;
  pinnedRepos: GitHubPinnedRepo[];
  topLanguages: string[];
}

export interface LinkedInRawCapture {
  url: string;
  headline?: string;
  location?: string;
  currentRole?: string;
  experiences: Array<{
    title?: string;
    company?: string;
    start?: string;
    end?: string;
  }>;
  education: string[];
  skills: string[];
}

export interface WebRawCapture {
  queries: string[];
  results: Array<{
    title: string;
    snippet?: string;
    url?: string;
    source?: string;
  }>;
}

export interface SocialScreenRawCapture {
  candidateId: string;
  candidateName: string;
  linkedin?: LinkedInRawCapture;
  github?: GitHubRawCapture;
  web?: WebRawCapture;
}

export interface SocialScreenResult {
  candidateId: string;
  socialScore: number;
  verifiedCount: number;
  warningCount: number;
  criticalCount: number;
  infoCount: number;
  findings: SocialFinding[];
  recommendation: string;
  summary: string;
  rawCapture?: SocialScreenRawCapture;
}