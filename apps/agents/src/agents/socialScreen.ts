// Path: apps/llm/agents/src/agents/socialScreen.ts
//
// Social Screen Agent (stub-first, UI-ready).
// Current goal:
// - deterministic local output now
// - easy to replace later with Nova Act capture + Bedrock reasoning
//
// This version returns:
// - richer social-intelligence findings
// - score and counts
// - legacy UI-friendly fields (fitScore / risk / evidence / actions)
// - supports BOTH old flat fields and newer nested linkedin/github/web input

export type SocialSource = "LinkedIn" | "GitHub" | "Google";
export type SocialRisk = "low" | "medium" | "high";
export type SocialFindingSeverity = "VERIFIED" | "WARNING" | "CRITICAL" | "INFO";

export interface SocialEvidenceItem {
  source: "resume" | "linkedin" | "github" | "google";
  level: "high" | "medium" | "low";
  quote: string;
}

export interface SocialSignal {
  source: SocialSource;
  found: boolean;
  confidence: number;
  summary?: string;
}

export interface SocialFinding {
  severity: SocialFindingSeverity;
  source: "linkedin" | "github" | "web";
  title: string;
  detail: string;
  confidence: number; // 0..1
}

export interface LinkedInExperienceInput {
  title: string;
  company: string;
  start: string;
  end?: string;
  description?: string;
}

export interface LinkedInSignalInput {
  url: string;
  headline?: string;
  currentCompany?: string;
  school?: string;
  skills?: string[];
  experiences?: LinkedInExperienceInput[];
}

export interface GitHubPinnedRepoInput {
  name: string;
  description?: string;
  language?: string;
  stars?: number;
}

export interface GitHubSignalInput {
  url: string;
  username?: string;
  displayName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  contributionsLastYear?: number;
  pinnedRepos?: GitHubPinnedRepoInput[];
  topLanguages?: string[];
}

export interface WebResultInput {
  title: string;
  snippet?: string;
  source?: string;
  url?: string;
}

export interface WebSignalInput {
  queries?: string[];
  results?: WebResultInput[];
}

export interface SocialScreenResult {
  candidateId: string;

  // richer social report
  socialScore: number;
  verifiedCount: number;
  warningCount: number;
  criticalCount: number;
  infoCount: number;
  totalFindings: number;
  findings: SocialFinding[];
  recommendation: string;

  // legacy / card-friendly fields
  fitScore: number;
  screenScore: number;
  risk: SocialRisk;
  technicalSkillsScore: number;
  technicalSkillsSummary: string;
  experienceScore: number;
  experienceSummary: string;
  communicationScore: number;
  communicationSummary: string;

  signals: SocialSignal[];
  evidence: SocialEvidenceItem[];
  flags: string[];
  recommendedActions: string[];
  summary: string;
}

export interface SocialScreenInput {
  candidateId: string;
  name: string;
  roleTitle?: string;
  school?: string;
  resumeText?: string;

  // legacy flat fields
  linkedinUrl?: string;
  githubUrl?: string;
  googleSummary?: string;

  // newer nested fields
  linkedin?: LinkedInSignalInput;
  github?: GitHubSignalInput;
  web?: WebSignalInput;
}

function contains(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

function clean(text?: string): string {
  return (text ?? "").trim();
}

function clipScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clip01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function pushFinding(findings: SocialFinding[], finding: SocialFinding): void {
  findings.push({
    ...finding,
    confidence: clip01(finding.confidence),
  });
}

function deriveRisk(args: {
  warningCount: number;
  criticalCount: number;
}): SocialRisk {
  if (args.criticalCount > 0) return "high";
  if (args.warningCount > 0) return "medium";
  return "low";
}

function getLinkedInUrl(input: SocialScreenInput): string {
  return clean(input.linkedin?.url) || clean(input.linkedinUrl);
}

function getGitHubUrl(input: SocialScreenInput): string {
  return clean(input.github?.url) || clean(input.githubUrl);
}

function getWebSummary(input: SocialScreenInput): string {
  if (clean(input.googleSummary)) return clean(input.googleSummary);

  const results = input.web?.results ?? [];
  const snippets = results
    .map((r) => clean(r.snippet) || clean(r.title))
    .filter(Boolean);

  return snippets.slice(0, 3).join(" | ");
}

function getLinkedInSkills(input: SocialScreenInput): string[] {
  return Array.isArray(input.linkedin?.skills)
    ? input.linkedin!.skills.map((s) => clean(s)).filter(Boolean)
    : [];
}

function getGitHubTopLanguages(input: SocialScreenInput): string[] {
  return Array.isArray(input.github?.topLanguages)
    ? input.github!.topLanguages.map((s) => clean(s)).filter(Boolean)
    : [];
}

function getGitHubPinnedRepos(input: SocialScreenInput): GitHubPinnedRepoInput[] {
  return Array.isArray(input.github?.pinnedRepos) ? input.github!.pinnedRepos : [];
}

function getLinkedInExperiences(input: SocialScreenInput): LinkedInExperienceInput[] {
  return Array.isArray(input.linkedin?.experiences) ? input.linkedin!.experiences : [];
}

export function runSocialScreen(input: SocialScreenInput): SocialScreenResult {
  const resume = clean(input.resumeText);
  const linkedInUrl = getLinkedInUrl(input);
  const gitHubUrl = getGitHubUrl(input);
  const googleSummary = getWebSummary(input);

  const linkedInSkills = getLinkedInSkills(input);
  const gitHubTopLanguages = getGitHubTopLanguages(input);
  const gitHubPinnedRepos = getGitHubPinnedRepos(input);
  const linkedInExperiences = getLinkedInExperiences(input);
  const webResults = input.web?.results ?? [];

  let technicalSkillsScore = 7;
  let experienceScore = 7;
  let communicationScore = 7;

  const evidence: SocialEvidenceItem[] = [];
  const findings: SocialFinding[] = [];
  const flags: string[] = [];

  const hasLinkedIn = !!linkedInUrl;
  const hasGitHub = !!gitHubUrl;
  const hasGoogle = !!googleSummary || webResults.length > 0;

  // -------------------------
  // Resume / profile-derived scoring
  // -------------------------
  if (
    contains(resume, [
      "pytorch",
      "react",
      "full-stack",
      "ml",
      "audio",
      "real-time",
      "typescript",
      "python",
    ]) ||
    linkedInSkills.length > 0 ||
    gitHubTopLanguages.length > 0
  ) {
    technicalSkillsScore = 9;
  }

  if (
    contains(resume, [
      "3 years",
      "three years",
      "production",
      "users",
      "10k",
      "internship",
      "shipped",
    ]) ||
    linkedInExperiences.length > 0 ||
    typeof input.github?.contributionsLastYear === "number"
  ) {
    experienceScore = 8;
  }

  if (
    contains(resume, ["built", "developed", "led", "improved", "shipped"]) ||
    clean(input.linkedin?.headline) ||
    clean(input.github?.bio)
  ) {
    communicationScore = 8;
  }

  // -------------------------
  // Evidence from resume
  // -------------------------
  if (
    contains(resume, [
      "real-time ai music transcription",
      "<100ms latency",
      "100ms latency",
    ])
  ) {
    evidence.push({
      source: "resume",
      level: "high",
      quote:
        "Developed real-time AI music transcription engine processing audio with <100ms latency",
    });
  }

  if (
    contains(resume, [
      "react-based music visualization dashboard",
      "10k+ users",
      "10k users",
    ])
  ) {
    evidence.push({
      source: "resume",
      level: "high",
      quote: "Built React-based music visualization dashboard used by 10K+ users",
    });
  }

  // -------------------------
  // LinkedIn findings
  // -------------------------
  if (hasLinkedIn) {
    pushFinding(findings, {
      severity: "VERIFIED",
      source: "linkedin",
      title: "LinkedIn profile found",
      detail: "Public profile exists and can be used to verify work history.",
      confidence: 0.92,
    });

    if (clean(input.linkedin?.headline)) {
      pushFinding(findings, {
        severity: "VERIFIED",
        source: "linkedin",
        title: "Professional headline present",
        detail: `Headline: ${clean(input.linkedin?.headline)}`,
        confidence: 0.84,
      });
    }

    if (linkedInExperiences.length > 0) {
      pushFinding(findings, {
        severity: "VERIFIED",
        source: "linkedin",
        title: "Work history available",
        detail: `LinkedIn includes ${linkedInExperiences.length} experience entr${
          linkedInExperiences.length === 1 ? "y" : "ies"
        } for verification.`,
        confidence: 0.86,
      });
    }

    const educationSchool = clean(input.linkedin?.school) || clean(input.school);
    if (educationSchool) {
      pushFinding(findings, {
        severity: "INFO",
        source: "linkedin",
        title: "Education context supplied",
        detail: `${educationSchool} provided for cross-checking.`,
        confidence: 0.78,
      });
    }
  } else {
    pushFinding(findings, {
      severity: "WARNING",
      source: "linkedin",
      title: "LinkedIn missing",
      detail: "No LinkedIn URL provided for work-history verification.",
      confidence: 0.9,
    });
    flags.push("Missing LinkedIn");
  }

  // -------------------------
  // GitHub findings
  // -------------------------
  if (hasGitHub) {
    pushFinding(findings, {
      severity: "VERIFIED",
      source: "github",
      title: "GitHub profile found",
      detail: "Public code profile is available for technical validation.",
      confidence: 0.9,
    });

    if (typeof input.github?.contributionsLastYear === "number") {
      pushFinding(findings, {
        severity: "VERIFIED",
        source: "github",
        title: "Recent GitHub activity",
        detail: `${input.github.contributionsLastYear} contributions in the last year indicate active development.`,
        confidence: 0.88,
      });
    }

    if (gitHubPinnedRepos.length > 0) {
      const totalStars = gitHubPinnedRepos.reduce(
        (sum, repo) => sum + (typeof repo.stars === "number" ? repo.stars : 0),
        0
      );

      pushFinding(findings, {
        severity: "VERIFIED",
        source: "github",
        title: "Pinned repositories available",
        detail:
          totalStars > 0
            ? `${gitHubPinnedRepos.length} pinned repos found with ${totalStars} total stars.`
            : `${gitHubPinnedRepos.length} pinned repos found for technical review.`,
        confidence: 0.84,
      });
    }

    if (gitHubTopLanguages.length > 0) {
      pushFinding(findings, {
        severity: "INFO",
        source: "github",
        title: "Top languages detected",
        detail: gitHubTopLanguages.slice(0, 4).join(", "),
        confidence: 0.8,
      });
    }
  } else {
    pushFinding(findings, {
      severity: "WARNING",
      source: "github",
      title: "GitHub missing",
      detail: "No GitHub URL provided for code or project verification.",
      confidence: 0.9,
    });
    flags.push("Missing GitHub");
  }

  // -------------------------
  // Web findings
  // -------------------------
  if (hasGoogle) {
    pushFinding(findings, {
      severity: "INFO",
      source: "web",
      title: "Public web references provided",
      detail: googleSummary || "Public web references are available for review.",
      confidence: 0.72,
    });

    const hackathonHit = webResults.find((r) =>
      contains(`${clean(r.title)} ${clean(r.snippet)}`, ["hackathon", "winner", "won"])
    );
    if (hackathonHit) {
      pushFinding(findings, {
        severity: "VERIFIED",
        source: "web",
        title: "Hackathon / competition signal found",
        detail: clean(hackathonHit.snippet) || clean(hackathonHit.title),
        confidence: 0.82,
      });
    }

    const talkHit = webResults.find((r) =>
      contains(`${clean(r.title)} ${clean(r.snippet)}`, ["conference", "talk", "presented", "speaker"])
    );
    if (talkHit) {
      pushFinding(findings, {
        severity: "INFO",
        source: "web",
        title: "Public speaking / event mention found",
        detail: clean(talkHit.snippet) || clean(talkHit.title),
        confidence: 0.74,
      });
    }
  } else {
    pushFinding(findings, {
      severity: "INFO",
      source: "web",
      title: "No external web summary provided",
      detail: "No extra public web context was supplied yet.",
      confidence: 0.6,
    });
  }

  // -------------------------
  // Resume-positive findings
  // -------------------------
  if (evidence.length > 0) {
    pushFinding(findings, {
      severity: "VERIFIED",
      source: "github",
      title: "Strong project evidence in resume",
      detail:
        "Resume contains concrete shipped-project language and measurable technical outcomes.",
      confidence: 0.84,
    });
  }

  // -------------------------
  // Counts / risk / score
  // -------------------------
  const verifiedCount = findings.filter((f) => f.severity === "VERIFIED").length;
  const warningCount = findings.filter((f) => f.severity === "WARNING").length;
  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const infoCount = findings.filter((f) => f.severity === "INFO").length;

  const totalFindings = findings.length;
  const risk = deriveRisk({ warningCount, criticalCount });

  const socialScoreBase =
    technicalSkillsScore * 4 + experienceScore * 3 + communicationScore * 3;

  const socialScoreBonus =
    (hasLinkedIn ? 6 : 0) +
    (hasGitHub ? 8 : 0) +
    (hasGoogle ? 4 : 0) +
    Math.min(verifiedCount * 2, 8);

  const socialScorePenalty = warningCount * 6 + criticalCount * 18;
  const socialScore = clipScore(socialScoreBase + socialScoreBonus - socialScorePenalty);

  const fitScore = socialScore;

  // screenScore is a compact “findings coverage” style score for UI cards
  const screenScore = Math.min(
    40,
    verifiedCount * 8 + infoCount * 2 + (warningCount > 0 ? 1 : 0)
  );

  const signals: SocialSignal[] = [
    {
      source: "LinkedIn",
      found: hasLinkedIn,
      confidence: hasLinkedIn ? 0.92 : 0.25,
      summary: hasLinkedIn
        ? "Profile available for work-history verification"
        : "No profile linked yet",
    },
    {
      source: "GitHub",
      found: hasGitHub,
      confidence: hasGitHub ? 0.9 : 0.25,
      summary: hasGitHub
        ? "Code activity can support technical claims"
        : "No GitHub linked yet",
    },
    {
      source: "Google",
      found: hasGoogle,
      confidence: hasGoogle ? 0.72 : 0.3,
      summary: hasGoogle
        ? "Public web references supplied"
        : "No strong public web signal supplied",
    },
  ];

  const recommendation =
    criticalCount > 0
      ? `${input.name}'s social presence shows a serious public-risk signal. Recommend hold for recruiter review.`
      : warningCount > 1
      ? `${input.name}'s social presence is usable but has minor gaps. Recommend quick verification before advancing.`
      : `${input.name}'s social presence is strong and broadly consistent with their application. Recommendation: proceed with high confidence.`;

  const recommendedActions = uniq([
    warningCount > 0 ? "Request missing profile link" : "",
    socialScore >= 85 ? "Schedule Interview" : "",
    hasLinkedIn || hasGitHub ? "Sync to ATS" : "",
    "Send Follow-up",
  ]);

  const summary =
    risk === "high"
      ? "Social screen found serious risk and should be reviewed before advancing."
      : risk === "medium"
      ? "Social screen found mostly positive signals with a few missing verification inputs."
      : "Social screen suggests strong technical fit with low public-risk signal.";

  return {
    candidateId: input.candidateId,
    socialScore,
    verifiedCount,
    warningCount,
    criticalCount,
    infoCount,
    totalFindings,
    findings,
    recommendation,
    fitScore,
    screenScore,
    risk,
    technicalSkillsScore,
    technicalSkillsSummary: "Strong PyTorch and full-stack skills",
    experienceScore,
    experienceSummary: "Relevant shipped-project and engineering experience",
    communicationScore,
    communicationSummary: "Clear technical communicator",
    signals,
    evidence,
    flags: uniq(flags),
    recommendedActions,
    summary,
  };
}