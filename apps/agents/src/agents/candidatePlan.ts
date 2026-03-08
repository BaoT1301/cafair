// Path: apps/llm/agents/src/agents/candidatePlan.ts
//
// Candidate-side action plan generator for AI Hire AI.
// Produces a clear step-by-step plan that the UI can render and that can later
// be sent to novaActStartRun(...).
//
// Main use cases:
// - candidate clicks "Run Plan"
// - agent suggests next steps (tailor resume, ask referral, apply, follow up)
// - UI shows a timeline of what the agent will do
//
// Works well with:
// - recruiter/candidate dual-sided demo
// - stub mode + real Nova Act mode

export type PlanStatus =
  | "Queued"
  | "Running"
  | "Success"
  | "Failed"
  | "NeedsApproval";

export type PlanActionType =
  | "CollectPreferences"
  | "FindJobs"
  | "TailorResume"
  | "GenerateMicroScreen"
  | "RequestReferral"
  | "ApplyToJob"
  | "TrackApplication"
  | "FollowUp";

export interface CandidatePreferences {
  roleKeywords?: string[];
  locations?: string[];
  remoteOnly?: boolean;
  salaryMin?: number;
  workAuth?: string;
  excludeCompanies?: string[];
  maxApplicationsPerDay?: number;
}

export interface CandidateProfileLite {
  candidateId: string;
  name?: string;
  school?: string;
  gradYear?: number;
  workAuth?: string;
  resumeText?: string;
  portfolioUrls?: string[];
}

export interface JobTarget {
  jobId: string;
  company: string;
  title: string;
  source: "CareerFair" | "LinkedIn" | "GitHub" | "CompanySite";
  url?: string;
  roleId?: string;
  fitScore?: number; // optional hint from matching layer
}

export interface PlanStep {
  stepId: string;
  title: string;
  type: PlanActionType;
  status: PlanStatus;
  requiresApproval: boolean;
  inputs?: Record<string, string | number | boolean | string[]>;
  expectedOutput?: string;
  notes?: string;
}

export interface CandidateActPlan {
  planId: string;
  candidateId: string;
  createdAtISO: string;
  goal: string;
  steps: PlanStep[];
  suggestions: string[];
  summary: string;
  debug?: {
    targetCount: number;
    usedMode: "demo" | "full";
    missingPreferences: boolean;
    thinResume: boolean;
  };
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function uniq(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function safeLower(s?: string) {
  return (s ?? "").trim().toLowerCase();
}

function looksLikeThinResume(resumeText?: string): boolean {
  const text = (resumeText ?? "").trim();
  if (!text) return true;
  return text.length < 140;
}

function preferencesMissing(p?: CandidatePreferences): boolean {
  if (!p) return true;

  const noRoles = (p.roleKeywords?.length ?? 0) === 0;
  const noLocationSignal =
    !p.remoteOnly && (p.locations?.length ?? 0) === 0;

  return noRoles || noLocationSignal;
}

function buildGoal(targets: JobTarget[]): string {
  if (targets.length === 0) {
    return "Find best-fit jobs and prepare application packet";
  }

  if (targets.length === 1) {
    return `Apply to ${targets[0].title} at ${targets[0].company}`;
  }

  return `Apply to ${targets.length} selected jobs with approval gates`;
}

function buildSuggestions(args: {
  hasTargets: boolean;
  thinResume: boolean;
  missingPreferences: boolean;
}): string[] {
  const suggestions: string[] = [
    "Show my current action plan",
    "Why is this job a match for me?",
    "Suggest the next best step before I apply",
  ];

  if (args.missingPreferences) {
    suggestions.push("Ask me to confirm role, location, and salary preferences");
  }

  if (args.thinResume) {
    suggestions.push("Improve my resume bullets before applying");
  } else {
    suggestions.push("Tailor my resume to the selected job description");
  }

  if (args.hasTargets) {
    suggestions.push("Draft a referral message and let me review it first");
    suggestions.push("Apply now and track the application status");
  } else {
    suggestions.push("Find matching jobs from fair booths and job boards");
  }

  return uniq(suggestions).slice(0, 6);
}

function createStep(args: {
  title: string;
  type: PlanActionType;
  requiresApproval?: boolean;
  status?: PlanStatus;
  inputs?: Record<string, string | number | boolean | string[]>;
  expectedOutput?: string;
  notes?: string;
}): PlanStep {
  const requiresApproval = args.requiresApproval ?? false;
  const status =
    args.status ??
    (requiresApproval ? "NeedsApproval" : "Queued");

  return {
    stepId: uid("step"),
    title: args.title,
    type: args.type,
    status,
    requiresApproval,
    inputs: args.inputs,
    expectedOutput: args.expectedOutput,
    notes: args.notes,
  };
}

function buildPreferenceStep(
  prefs?: CandidatePreferences
): PlanStep {
  return createStep({
    title: "Confirm preferences",
    type: "CollectPreferences",
    requiresApproval: true,
    inputs: {
      roleKeywords: prefs?.roleKeywords ?? [],
      locations: prefs?.locations ?? [],
      remoteOnly: prefs?.remoteOnly ?? false,
      salaryMin: prefs?.salaryMin ?? 0,
      workAuth: prefs?.workAuth ?? "",
    },
    expectedOutput: "Saved role, location, and application rules",
    notes:
      "Confirm job interests, location/remote preferences, and basic constraints before the plan runs.",
  });
}

function buildFindJobsStep(
  prefs?: CandidatePreferences
): PlanStep {
  return createStep({
    title: "Find matching jobs",
    type: "FindJobs",
    requiresApproval: false,
    inputs: {
      roleKeywords: prefs?.roleKeywords ?? [],
      locations: prefs?.locations ?? [],
      remoteOnly: prefs?.remoteOnly ?? false,
      excludeCompanies: prefs?.excludeCompanies ?? [],
      maxApplicationsPerDay: prefs?.maxApplicationsPerDay ?? 0,
    },
    expectedOutput: "Ranked job list from fair booths and external sources",
    notes:
      "Search candidate-approved sources and return best-fit roles with matching reasons.",
  });
}

function buildResumeFoundationStep(): PlanStep {
  return createStep({
    title: "Strengthen resume basics",
    type: "TailorResume",
    requiresApproval: true,
    expectedOutput: "Cleaner baseline resume with stronger bullet structure",
    notes:
      "Resume looks thin. Suggest stronger, measurable bullets before job-specific tailoring.",
  });
}

function buildTargetSteps(target: JobTarget): PlanStep[] {
  const steps: PlanStep[] = [];

  steps.push(
    createStep({
      title: `Tailor resume for ${target.company}`,
      type: "TailorResume",
      requiresApproval: true,
      inputs: {
        company: target.company,
        title: target.title,
        source: target.source,
        jobId: target.jobId,
        url: target.url ?? "",
      },
      expectedOutput: "ATS-friendly tailored resume + before/after diff",
      notes:
        "Highlight matched keywords, fill missing skill phrasing, and require candidate approval before saving.",
    })
  );

  steps.push(
    createStep({
      title: `Generate micro-screen for ${target.company}`,
      type: "GenerateMicroScreen",
      requiresApproval: false,
      inputs: {
        company: target.company,
        title: target.title,
        roleId: target.roleId ?? "",
      },
      expectedOutput: "2–3 short questions with transcript-ready capture",
      notes:
        "Capture quick signal before submitting so recruiters have cleaner context.",
    })
  );

  if (
    target.source === "CareerFair" ||
    target.source === "LinkedIn" ||
    target.source === "CompanySite"
  ) {
    steps.push(
      createStep({
        title: `Draft referral request for ${target.company}`,
        type: "RequestReferral",
        requiresApproval: true,
        inputs: {
          company: target.company,
          channel:
            target.source === "LinkedIn" ? "LinkedIn" : "Email/Connection",
        },
        expectedOutput: "Short referral message draft",
        notes:
          "Suggest a referral outreach draft. No message is sent without approval.",
      })
    );
  }

  steps.push(
    createStep({
      title: `Apply to ${target.company}`,
      type: "ApplyToJob",
      requiresApproval: true,
      inputs: {
        company: target.company,
        title: target.title,
        source: target.source,
        jobId: target.jobId,
        url: target.url ?? "",
      },
      expectedOutput: "Application submitted with confirmation captured",
      notes:
        "Open the posting, fill fields, upload assets, and submit only after candidate approval.",
    })
  );

  steps.push(
    createStep({
      title: `Track ${target.company} application`,
      type: "TrackApplication",
      requiresApproval: false,
      inputs: {
        company: target.company,
        title: target.title,
      },
      expectedOutput: "Tracked application state + timeline",
      notes:
        "Record submission and keep a simple status timeline in the candidate dashboard.",
    })
  );

  steps.push(
    createStep({
      title: `Follow up with ${target.company}`,
      type: "FollowUp",
      requiresApproval: true,
      inputs: {
        company: target.company,
        daysAfterSubmit: 4,
      },
      expectedOutput: "Follow-up draft scheduled after submission",
      notes:
        "Prepare a polite follow-up draft 3–5 days after submission. Candidate reviews before sending.",
    })
  );

  return steps;
}

function buildSummary(args: {
  targetCount: number;
  missingPreferences: boolean;
  thinResume: boolean;
}): string {
  const parts: string[] = [];

  if (args.targetCount === 0) {
    parts.push("No target jobs yet");
  } else if (args.targetCount === 1) {
    parts.push("1 target job selected");
  } else {
    parts.push(`${args.targetCount} target jobs selected`);
  }

  parts.push(
    args.missingPreferences
      ? "preferences need confirmation"
      : "preferences are set"
  );

  parts.push(
    args.thinResume
      ? "resume needs improvement first"
      : "resume ready for tailoring"
  );

  return parts.join(" • ");
}

export function buildCandidateActPlan(args: {
  candidate: CandidateProfileLite;
  preferences?: CandidatePreferences;
  targets: JobTarget[];
  mode?: "demo" | "full";
}): CandidateActPlan {
  const mode = args.mode ?? "demo";
  const { candidate, preferences } = args;

  const targetLimit = mode === "demo" ? 1 : args.targets.length;
  const targets = args.targets.slice(0, targetLimit);

  const thinResume = looksLikeThinResume(candidate.resumeText);
  const missingPreferences = preferencesMissing(preferences);

  const steps: PlanStep[] = [];

  if (missingPreferences) {
    steps.push(buildPreferenceStep(preferences));
  }

  if (targets.length === 0) {
    steps.push(buildFindJobsStep(preferences));
  }

  if (thinResume) {
    steps.push(buildResumeFoundationStep());
  }

  for (const target of targets) {
    steps.push(...buildTargetSteps(target));
  }

  // If somehow no steps were generated, keep one sensible fallback
  if (steps.length === 0) {
    steps.push(
      createStep({
        title: "Find matching jobs",
        type: "FindJobs",
        requiresApproval: false,
        expectedOutput: "Ranked list of suggested jobs",
        notes: "Fallback step to keep the plan usable.",
      })
    );
  }

  // For UI clarity, make the first step active if it does not need approval.
  const first = steps[0];
  if (first && !first.requiresApproval) {
    first.status = "Running";
    first.status = "Queued"; // keep initial plan non-destructive; actual run changes status
  }

  const goal = buildGoal(targets);
  const suggestions = buildSuggestions({
    hasTargets: targets.length > 0,
    thinResume,
    missingPreferences,
  });

  const summary = buildSummary({
    targetCount: targets.length,
    missingPreferences,
    thinResume,
  });

  return {
    planId: uid("plan"),
    candidateId: candidate.candidateId,
    createdAtISO: new Date().toISOString(),
    goal,
    steps,
    suggestions,
    summary,
    debug: {
      targetCount: targets.length,
      usedMode: mode,
      missingPreferences,
      thinResume,
    },
  };
}