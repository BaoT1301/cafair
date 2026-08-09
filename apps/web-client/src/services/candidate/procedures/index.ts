/**
 * Candidate-facing tRPC surface.
 * ────────────────────────────────────────────────────────────────────────
 * SECURITY MODEL — read before adding a procedure here.
 *
 * 1. Identity comes from Clerk's *verified* primary email, never from client
 *    input. `candidates.email` is the join key. A candidate can only ever
 *    reach the row whose email Clerk has confirmed they own.
 *
 * 2. Every query filters by that email IN THE QUERY ITSELF. We deliberately
 *    do NOT reuse the recruiter router's `rls()` helper
 *    (services/recruiter/procedures/index.ts:31-49) — that helper catches RLS
 *    failures and falls through to an unfiltered `ctx.db` read. Failing open
 *    is survivable for a recruiter who is allowed to see every candidate; for
 *    a candidate it would hand them the entire applicant table. Here the
 *    identity predicate is part of the SQL, so a misconfigured policy cannot
 *    widen the result set.
 *
 * 3. Rows leave this file only through `toCandidateView` / `toRoleView` /
 *    `toEvidenceView`. Never return a raw row — see `../view.ts` for why.
 */

import { createTRPCRouter, dbProcedure } from "@/server/init";
import { db as _db } from "@/db";
import { candidates, jobRoles, events, evidence } from "@/services/recruiter/schema";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq, asc, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  toCandidateView,
  toRoleView,
  toEvidenceView,
  STAGE_ORDER,
  normalizeStage,
  type CandidateView,
  type RoleView,
} from "../view";

/**
 * Resolves the signed-in Clerk user's verified primary email.
 * Throws rather than returning null — every procedure in this router needs a
 * trustworthy identity, and a silent null would turn into an unfiltered query.
 */
async function requireVerifiedEmail(): Promise<{ email: string; firstName: string | null; lastName: string | null; imageUrl: string | null }> {
  const user = await currentUser();
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in." });
  }

  const primary =
    user.primaryEmailAddress ??
    user.emailAddresses.find((e) => e.emailAddress);

  if (!primary?.emailAddress) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account has no email address, so we can't locate your application.",
    });
  }

  // Clerk marks unverified addresses; refuse them. Otherwise someone could
  // claim another person's candidate row by adding their email unverified.
  const verified = primary.verification?.status === "verified";
  if (!verified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Please verify your email address before viewing your application.",
    });
  }

  return {
    email: primary.emailAddress.toLowerCase(),
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl ?? null,
  };
}

/** Case-insensitive email match. `candidates.email` has no normalization guarantee. */
const emailMatches = (email: string) => sql`lower(${candidates.email}) = ${email}`;

/**
 * Finds the caller's candidate row, creating one on first visit.
 *
 * Auto-provisioning matters because the seed never populates `candidates.email`
 * (src/db/seed.ts) — without this, every real sign-in would hit an empty state
 * and the product would look broken. A recruiter-created row with a matching
 * email is claimed automatically; otherwise the candidate gets their own row.
 */
async function findOrCreateMe(identity: Awaited<ReturnType<typeof requireVerifiedEmail>>) {
  return _db.transaction(async (tx) => {
    // Serialise provisioning per-email.
    //
    // Every procedure in this router calls findOrCreateMe, and the candidate
    // home page fires four of them in parallel. Without this lock all four
    // race: each SELECTs, finds nothing, and INSERTs — producing duplicate
    // rows for one person. (Observed in testing: 3 rows in 38ms.)
    //
    // `hashtext` maps the email to the bigint the lock API wants. The lock is
    // transaction-scoped, so it releases on COMMIT or ROLLBACK with no
    // cleanup path to forget.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identity.email}))`);

    // Oldest-first, so that if duplicates already exist from before this fix
    // every caller still converges on the same canonical row.
    const existing = await tx
      .select()
      .from(candidates)
      .where(emailMatches(identity.email))
      .orderBy(asc(candidates.createdAt))
      .limit(1);

    if (existing[0]) return existing[0];

    const displayName =
      [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim() ||
      identity.email.split("@")[0];

    // `userId` is NOT NULL and means "who created this row". A self-registered
    // candidate is their own creator; we tag it so recruiter-side queries can
    // tell self-serve rows from imported ones.
    const created = await tx
      .insert(candidates)
      .values({
        userId: `candidate:${identity.email}`,
        name: displayName,
        email: identity.email,
        avatarUrl: identity.imageUrl,
        stage: "fair",
        fitScore: 0,
      })
      .returning();

    return created[0];
  });
}

/**
 * Keyword overlap between a candidate's evidence/strengths and a role's skills.
 * Deliberately deterministic and explainable — the candidate is shown exactly
 * which skills matched. An opaque model score would be worse product here and
 * harder to defend under a right-to-explanation request.
 */
function scoreRoleMatch(
  candidate: CandidateView,
  role: RoleView,
  haystack: string,
): { score: number; matched: string[]; missing: string[] } {
  const must = role.mustHaveSkills;
  const nice = role.niceToHaveSkills;
  const all = [...must, ...nice];

  if (all.length === 0) {
    // No rubric on the role — fall back to the candidate's own fit score so
    // the list still orders sensibly instead of collapsing to all-zero.
    return { score: candidate.fitScore, matched: [], missing: [] };
  }

  // Collapse all whitespace before matching. Without this, a multi-word skill
  // fails whenever the resume happens to wrap between its words — "Machine
  // Learning" split across two lines would be reported as missing even though
  // the candidate clearly has it. Pasted resumes wrap constantly.
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
  const text = normalize(haystack);
  const hit = (skill: string) => text.includes(normalize(skill));

  const matchedMust = must.filter(hit);
  const matchedNice = nice.filter(hit);
  const matched = [...matchedMust, ...matchedNice];
  const missing = must.filter((s) => !hit(s));

  // Must-haves carry 70% of the weight, nice-to-haves 30%.
  const mustPart = must.length ? (matchedMust.length / must.length) * 70 : 70;
  const nicePart = nice.length ? (matchedNice.length / nice.length) * 30 : 30;

  return { score: Math.round(mustPart + nicePart), matched, missing };
}

export const candidateRouter = createTRPCRouter({
  /** The caller's own profile. Creates it on first visit. */
  getMyProfile: dbProcedure.query(async () => {
    const identity = await requireVerifiedEmail();
    const row = await findOrCreateMe(identity);
    return toCandidateView(row);
  }),

  /**
   * Stage timeline. Derived from the current stage rather than an event log —
   * there is no stage-history table, and inventing one would mean a migration
   * against a live database. Everything up to the current stage is shown as
   * reached; nothing is fabricated with false timestamps.
   */
  getMyTimeline: dbProcedure.query(async () => {
    const identity = await requireVerifiedEmail();
    const row = await findOrCreateMe(identity);
    const current = normalizeStage(row.stage);
    const currentIndex = STAGE_ORDER.indexOf(current);

    return STAGE_ORDER.map((stage, i) => ({
      stage,
      reached: i <= currentIndex,
      current: i === currentIndex,
    }));
  }),

  /** Evidence the candidate has on file. Their own submissions only. */
  getMyEvidence: dbProcedure.query(async () => {
    const identity = await requireVerifiedEmail();
    const row = await findOrCreateMe(identity);

    const rows = await _db
      .select()
      .from(evidence)
      .where(eq(evidence.candidateId, row.id))
      .orderBy(desc(evidence.createdAt));

    return rows.map(toEvidenceView);
  }),

  /** Open roles, ranked against the caller's profile with an explainable score. */
  getMyMatches: dbProcedure.query(async () => {
    const identity = await requireVerifiedEmail();
    const me = toCandidateView(await findOrCreateMe(identity));

    const roles = await _db.select().from(jobRoles);

    // Build the text we match against: the candidate's own AI-derived signal
    // plus any evidence text they've submitted.
    const evidenceRows = await _db
      .select()
      .from(evidence)
      .where(eq(evidence.candidateId, me.id));

    const haystack = [
      me.role ?? "",
      me.school ?? "",
      me.summary ?? "",
      ...me.strengths,
      ...evidenceRows.map((e) => e.content ?? ""),
    ].join(" ");

    return roles
      .map((r) => {
        const role = toRoleView(r);
        const { score, matched, missing } = scoreRoleMatch(me, role, haystack);
        return { role, score, matched, missing, applied: me.role === role.title };
      })
      .sort((a, b) => b.score - a.score);
  }),

  /** The live career fair, if one is running. Public event info only. */
  getActiveEvent: dbProcedure.query(async () => {
    const rows = await _db
      .select()
      .from(events)
      .where(eq(events.status, "live"))
      .limit(1);

    const e = rows[0];
    if (!e) return null;

    return {
      id: e.id,
      name: e.name,
      date: e.date,
      location: e.location,
      recruiterCount: e.recruiterCount ?? 0,
    };
  }),

  /** Editable profile fields. Scoring fields are deliberately not writable. */
  updateMyProfile: dbProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120).optional(),
        school: z.string().max(160).optional(),
        role: z.string().max(160).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const identity = await requireVerifiedEmail();
      const me = await findOrCreateMe(identity);

      const updated = await _db
        .update(candidates)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(candidates.id, me.id))
        .returning();

      return toCandidateView(updated[0]);
    }),

  /** Check in to the live fair. Idempotent — re-checking in keeps the first time. */
  checkIn: dbProcedure.mutation(async () => {
    const identity = await requireVerifiedEmail();
    const me = await findOrCreateMe(identity);

    if (me.checkedInAt) return toCandidateView(me);

    const updated = await _db
      .update(candidates)
      .set({ checkedInAt: new Date(), updatedAt: new Date() })
      .where(eq(candidates.id, me.id))
      .returning();

    return toCandidateView(updated[0]);
  }),

  /**
   * Submit a resume and get it scored.
   *
   * Stores the text as `evidence`, then calls the same `/api/score` engine the
   * recruiter side uses (apps/llm). Using one engine for both sides is the
   * point: the feedback a candidate sees is the assessment recruiters act on,
   * not a softened parallel score.
   *
   * If the LLM service is unreachable the evidence is still saved and the
   * mutation reports `scored: false` — a dev machine without apps/llm running
   * should not lose the candidate's submission.
   */
  submitResume: dbProcedure
    .input(
      z.object({
        resumeText: z.string().min(80, "Add a bit more detail — at least 80 characters."),
        roleId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const identity = await requireVerifiedEmail();
      const me = await findOrCreateMe(identity);

      await _db.insert(evidence).values({
        candidateId: me.id,
        type: "resume",
        content: input.resumeText,
      });

      // Resolve a job description to score against.
      let jobDescription = "";
      let roleTitle: string | null = null;
      if (input.roleId) {
        const r = await _db
          .select()
          .from(jobRoles)
          .where(eq(jobRoles.id, input.roleId))
          .limit(1);
        if (r[0]) {
          roleTitle = r[0].title;
          jobDescription = [
            r[0].title,
            r[0].jobDescription ?? "",
            ...(r[0].mustHaveSkills ?? []),
            ...(r[0].niceToHaveSkills ?? []),
          ]
            .filter(Boolean)
            .join("\n");
        }
      }

      const base = process.env.LLM_URL ?? "http://localhost:3001";
      let scored = false;

      try {
        const res = await fetch(`${base}/api/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateId: me.id,
            resume: input.resumeText,
            jobDescription: jobDescription || "General software internship.",
          }),
          signal: AbortSignal.timeout(25000),
        });

        if (res.ok) {
          const json = await res.json();
          const d = json?.data ?? json;
          if (typeof d?.fit_score === "number") {
            await _db
              .update(candidates)
              .set({
                fitScore: Math.max(0, Math.min(100, Math.round(d.fit_score))),
                strengths: Array.isArray(d.strengths) ? d.strengths : [],
                gaps: Array.isArray(d.gaps) ? d.gaps : [],
                summary: typeof d.summary === "string" ? d.summary : null,
                // risk_level is intentionally NOT persisted from a candidate-initiated
                // scoring run. A person must not be able to move their own risk flag,
                // and it is never shown to them anyway.
                role: roleTitle ?? me.role,
                roleId: input.roleId ?? me.roleId,
                updatedAt: new Date(),
              })
              .where(eq(candidates.id, me.id));
            scored = true;
          }
        }
      } catch {
        // LLM service down or slow — evidence is saved, scoring can be retried.
      }

      const fresh = await _db
        .select()
        .from(candidates)
        .where(eq(candidates.id, me.id))
        .limit(1);

      return { scored, profile: toCandidateView(fresh[0]) };
    }),
});
