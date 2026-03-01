// Path: apps/llm/agents/src/agents/socialScreen.ts
// yessir
// Social Screen Agent (stub-first, UI-ready).
// Current goal:
// - deterministic local output now
// - easy to replace later with Nova Act capture + Bedrock reasoning
//
// This version returns:
// - richer social-intelligence findings
// - score and counts
// - legacy UI-friendly fields (fitScore / risk / evidence / actions)

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
  confidence: number;
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
  linkedinUrl?: string;
  githubUrl?: string;
  googleSummary?: string;
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

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function pushFinding(
  findings: SocialFinding[],
  finding: SocialFinding
): void {
  findings.push(finding);
}

function deriveRisk(args: {
  warningCount: number;
  criticalCount: number;
}): SocialRisk {
  if (args.criticalCount > 0) return "high";
  if (args.warningCount > 0) return "medium";
  return "low";
}

export function runSocialScreen(input: SocialScreenInput): SocialScreenResult {
  const resume = clean(input.resumeText);
  const googleSummary = clean(input.googleSummary);

  let technicalSkillsScore = 7;
  let experienceScore = 7;
  let communicationScore = 7;

  const evidence: SocialEvidenceItem[] = [];
  const findings: SocialFinding[] = [];
  const flags: string[] = [];

  const hasLinkedIn = !!input.linkedinUrl;
  const hasGitHub = !!input.githubUrl;
  const hasGoogle = !!googleSummary;

  // -------------------------
  // Resume-derived scoring
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
    ])
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
    ])
  ) {
    experienceScore = 8;
  }

  if (
    contains(resume, ["built", "developed", "led", "improved", "shipped"])
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
      quote:
        "Built React-based music visualization dashboard used by 10K+ users",
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

    if (
      input.school &&
      contains(input.school, ["virginia tech", "georgia tech"]) &&
      contains(input.school, [input.school])
    ) {
      pushFinding(findings, {
        severity: "VERIFIED",
        source: "linkedin",
        title: "Education context supplied",
        detail: `${input.school} provided for cross-checking.`,
        confidence: 0.8,
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

    if (
      contains(resume, [
        "react",
        "typescript",
        "python",
        "full-stack",
        "pytorch",
      ])
    ) {
      pushFinding(findings, {
        severity: "VERIFIED",
        source: "github",
        title: "GitHub likely supports technical claims",
        detail:
          "Resume indicates code-based technical work that can be cross-checked against repositories.",
        confidence: 0.82,
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
      detail: googleSummary,
      confidence: 0.72,
    });
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
  const verifiedCount = findings.filter(
    (f) => f.severity === "VERIFIED"
  ).length;
  const warningCount = findings.filter(
    (f) => f.severity === "WARNING"
  ).length;
  const criticalCount = findings.filter(
    (f) => f.severity === "CRITICAL"
  ).length;
  const infoCount = findings.filter((f) => f.severity === "INFO").length;

  const totalFindings = findings.length;
  const risk = deriveRisk({ warningCount, criticalCount });

  const socialScoreBase =
    technicalSkillsScore * 4 +
    experienceScore * 3 +
    communicationScore * 3;

  const socialScorePenalty = warningCount * 6 + criticalCount * 18;
  const socialScore = clipScore(socialScoreBase - socialScorePenalty);

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