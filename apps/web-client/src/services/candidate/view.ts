/**
 * Candidate-facing projections.
 * ────────────────────────────────────────────────────────────────────────
 * This module is the ONLY place a `candidates` row is allowed to become
 * something a candidate can see. Everything under `services/candidate/`
 * must return values built here — never a raw row.
 *
 * WHY THIS IS AN ALLOWLIST AND NOT A "DELETE THE BAD FIELDS" FILTER:
 * a denylist silently leaks every column added to the schema later. New
 * recruiter-internal columns are invisible by default here; someone has to
 * consciously add a field to `CandidateView` for it to ever reach a browser.
 *
 * DELIBERATELY NEVER EXPOSED:
 *   riskLevel   — an adverse internal judgement about a person. Showing a
 *                 candidate they are flagged "high risk" is indefensible
 *                 product and legally hazardous.
 *   lane        — `redirect` literally means "we are steering this person
 *                 away from a recruiter". Internal routing, never candidate-facing.
 *   ownerId     — the assigned recruiter's Clerk ID. Internal staffing.
 *   userId      — the recruiter who created the row.
 *   nextAction  — recruiter's private to-do about this person.
 *   verified    — internal trust signal.
 *
 * What IS exposed (fitScore, strengths, gaps, summary) is the candidate's own
 * assessment. Under the EU AI Act's high-risk hiring rules, in force since
 * 2026-08-02, a person assessed by an automated tool has a right to an
 * explanation of the main elements of the decision. That is exactly this data,
 * which is why it is surfaced rather than hidden.
 */

import type { InferSelectModel } from "drizzle-orm";
import type { candidates, jobRoles, evidence } from "@/services/recruiter/schema";

type CandidateRow = InferSelectModel<typeof candidates>;
type RoleRow = InferSelectModel<typeof jobRoles>;
type EvidenceRow = InferSelectModel<typeof evidence>;

/** Pipeline stages, ordered. Mirrors `candidates.stage`. */
export const STAGE_ORDER = ["fair", "screen", "interview", "offer", "day1"] as const;
export type Stage = (typeof STAGE_ORDER)[number];

/**
 * Recruiter-internal stage names translated into something a candidate should
 * actually read. "day1" means nothing to an applicant.
 */
const STAGE_LABEL: Record<Stage, string> = {
  fair: "Application received",
  screen: "In screening",
  interview: "Interview stage",
  offer: "Offer extended",
  day1: "Hired",
};

const STAGE_BLURB: Record<Stage, string> = {
  fair: "Your profile is in the pool and has been scored.",
  screen: "A recruiter is reviewing your profile in detail.",
  interview: "You've advanced to interviews for this role.",
  offer: "An offer is on the table. Check your email.",
  day1: "You're hired. Welcome aboard.",
};

export function normalizeStage(raw: string | null): Stage {
  return (STAGE_ORDER as readonly string[]).includes(raw ?? "")
    ? (raw as Stage)
    : "fair";
}

export type CandidateView = {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  role: string | null;
  avatarUrl: string | null;
  /** 0-100. The candidate's own AI fit assessment. */
  fitScore: number;
  stage: Stage;
  stageLabel: string;
  stageBlurb: string;
  /** Index into STAGE_ORDER, for progress rendering. */
  stageIndex: number;
  strengths: string[];
  gaps: string[];
  summary: string | null;
  /** True once any AI assessment has actually run for this person. */
  scored: boolean;
  checkedInAt: Date | null;
  createdAt: Date | null;
};

export function toCandidateView(row: CandidateRow): CandidateView {
  const stage = normalizeStage(row.stage);
  const strengths = row.strengths ?? [];
  const gaps = row.gaps ?? [];

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    school: row.school,
    role: row.role,
    avatarUrl: row.avatarUrl,
    fitScore: row.fitScore ?? 0,
    stage,
    stageLabel: STAGE_LABEL[stage],
    stageBlurb: STAGE_BLURB[stage],
    stageIndex: STAGE_ORDER.indexOf(stage),
    strengths,
    gaps,
    summary: row.summary,
    // A seeded row defaults fitScore to 0 with empty arrays. Treat that as
    // "not assessed yet" rather than "assessed as a zero", which would be a
    // demoralising and untrue thing to show someone.
    scored: (row.fitScore ?? 0) > 0 || strengths.length > 0 || gaps.length > 0,
    checkedInAt: row.checkedInAt,
    createdAt: row.createdAt,
  };
}

/**
 * Roles as a candidate sees them.
 * Hiring-plan internals (targetHires, offersNeeded/Sent/Accepted, status) are
 * commercially sensitive — "this role is at_risk" tells a candidate how
 * desperate the employer is, which is not theirs to know.
 */
export type RoleView = {
  id: string;
  title: string;
  department: string | null;
  jobDescription: string | null;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
};

export function toRoleView(row: RoleRow): RoleView {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    jobDescription: row.jobDescription,
    mustHaveSkills: row.mustHaveSkills ?? [],
    niceToHaveSkills: row.niceToHaveSkills ?? [],
  };
}

/** A candidate may see their own submitted evidence, but never its recruiter annotations. */
export type EvidenceView = {
  id: string;
  type: string;
  url: string | null;
  hasContent: boolean;
  createdAt: Date | null;
};

export function toEvidenceView(row: EvidenceRow): EvidenceView {
  return {
    id: row.id,
    type: row.type,
    // Seed data writes a literal "#" placeholder; don't render that as a link.
    url: row.url && row.url !== "#" ? row.url : null,
    hasContent: Boolean(row.content),
    createdAt: row.createdAt,
  };
}
