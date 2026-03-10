import { createTRPCRouter, authedProcedure, dbProcedure } from "@/server/init";
import {
  candidates,
  jobRoles,
  events,
  evidence,
  recruiterActions,
} from "../schema";
import { z } from "zod";
import { eq, desc, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── New split procedures ────────────────────────────────
import { getActionsByCandidate } from "./get-actions-by-candidate";
import { markFollowUpSent } from "./mark-follow-up-sent";
import { updateCandidateOwner } from "./update-candidate-owner";
import { updateCandidateScore } from "./update-candidate-score";
import { scoreCandidate } from "./score-candidate";

// ─── AI Hire AI / Bedrock ────────────────────────────────
import { getBedrockScreen } from "@/server/aihire/bedrock";

export const recruiterRouter = createTRPCRouter({
  // ─── Candidates ───────────────────────────────────────────

  getCandidates: authedProcedure.query(async ({ ctx }) => {
    return ctx.secureDb!.rls((tx) =>
      tx.select().from(candidates).orderBy(desc(candidates.fitScore)),
    );
  }),

  getCandidateById: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [candidate] = await ctx.secureDb!.rls((tx) =>
        tx.select().from(candidates).where(eq(candidates.id, input.id)),
      );
      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
      }
      return candidate;
    }),

  getCandidateWithEvidence: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [candidate] = await ctx.secureDb!.rls((tx) =>
        tx.select().from(candidates).where(eq(candidates.id, input.id)),
      );
      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
      }
      const candidateEvidence = await ctx.secureDb!.rls((tx) =>
        tx.select().from(evidence).where(eq(evidence.candidateId, input.id)),
      );
      return { ...candidate, evidence: candidateEvidence };
    }),

  updateCandidateStage: dbProcedure
    .input(
      z.object({
        id: z.string(),
        stage: z.enum(["fair", "screen", "interview", "offer", "day1"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(candidates)
        .set({ stage: input.stage, updatedAt: new Date() })
        .where(eq(candidates.id, input.id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
      }
      return updated;
    }),

  updateCandidateLane: dbProcedure
    .input(
      z.object({
        id: z.string(),
        lane: z.enum(["recruiter_now", "quick_screen", "redirect"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(candidates)
        .set({ lane: input.lane, updatedAt: new Date() })
        .where(eq(candidates.id, input.id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
      }
      return updated;
    }),

  // ─── Bedrock recruiter screen ───────────────────────────

  getBedrockScreen: authedProcedure
    .input(
      z.object({
        candidateId: z.string(),
        name: z.string(),
        roleTitle: z.string(),
        companyName: z.string().optional(),
        resumeText: z.string(),
        roleRequirements: z.array(z.string()).optional(),
        transcriptText: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return getBedrockScreen(input);
    }),

  // ─── Job Roles ────────────────────────────────────────────

  getRoles: authedProcedure.query(async ({ ctx }) => {
    return ctx.secureDb!.rls((tx) => tx.select().from(jobRoles));
  }),

  // ─── Events ───────────────────────────────────────────────

  getEvents: authedProcedure.query(async ({ ctx }) => {
    return ctx.secureDb!.rls((tx) => tx.select().from(events));
  }),

  getActiveEvent: authedProcedure.query(async ({ ctx }) => {
    const [event] = await ctx.secureDb!.rls((tx) =>
      tx.select().from(events).where(eq(events.status, "live")),
    );
    return event ?? null;
  }),

  // ─── Dashboard Stats ──────────────────────────────────────

  getDashboardStats: authedProcedure.query(async ({ ctx }) => {
    const stageCounts = await ctx.secureDb!.rls((tx) =>
      tx
        .select({ stage: candidates.stage, count: count() })
        .from(candidates)
        .groupBy(candidates.stage),
    );
    const allRoles = await ctx.secureDb!.rls((tx) =>
      tx.select().from(jobRoles),
    );

    const getCount = (stage: string) =>
      stageCounts.find((s) => s.stage === stage)?.count ?? 0;

    return {
      totalCandidates: stageCounts.reduce((sum, s) => sum + s.count, 0),
      inQueue: getCount("fair"),
      inInterview: getCount("interview"),
      offers: getCount("offer"),
      projectedHires: allRoles.reduce(
        (sum, r) => sum + (r.targetHires ?? 0),
        0,
      ),
      roles: allRoles,
    };
  }),

  // ─── Recruiter Actions (ATS Sync) ─────────────────────────

  getActions: authedProcedure.query(async ({ ctx }) => {
    return ctx.secureDb!.rls((tx) =>
      tx
        .select()
        .from(recruiterActions)
        .orderBy(desc(recruiterActions.createdAt)),
    );
  }),

  createAction: dbProcedure
    .input(
      z.object({
        candidateId: z.string(),
        actionType: z.enum([
          "sync_to_ats",
          "follow_up_email",
          "schedule_interview",
          "move_stage",
        ]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [candidate] = await ctx.db
        .select({ id: candidates.id })
        .from(candidates)
        .where(eq(candidates.id, input.candidateId));
      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
      }
      const [action] = await ctx.db
        .insert(recruiterActions)
        .values({
          userId: ctx.user.id,
          candidateId: input.candidateId,
          actionType: input.actionType,
          notes: input.notes,
          status: "queued",
        })
        .returning();
      return action;
    }),

  // ─── Job Roles — mutations ─────────────────────────────────

  createRole: authedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        department: z.string().optional(),
        jobDescription: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [role] = await ctx.secureDb!.rls((tx) =>
        tx
          .insert(jobRoles)
          .values({
            userId: ctx.user.id,
            title: input.title,
            department: input.department ?? null,
            jobDescription: input.jobDescription ?? null,
            status: "on_track",
          })
          .returning(),
      );
      return role;
    }),

  // ─── Role Alignment ────────────────────────────────────────

  getRoleById: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [role] = await ctx.secureDb!.rls((tx) =>
        tx.select().from(jobRoles).where(eq(jobRoles.id, input.id)).limit(1),
      );
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
      return {
        ...role,
        // Alignment fields not yet in DB — return empty defaults
        criteria: [],
        experienceRange: { min: 3, max: 7, autoReject: false },
        dealbreakers: [],
        thresholds: { advance: 80, review: 65, reject: 65, autoReject: false },
        interviewFocusAreas: [],
        riskTolerance: 42,
      };
    }),

  saveRoleAlignment: authedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        jobDescription: z.string().optional(),
        criteria: z.any().optional(),
        experienceRange: z.any().optional(),
        dealbreakers: z.any().optional(),
        thresholds: z.any().optional(),
        interviewFocusAreas: z.array(z.string()).optional(),
        riskTolerance: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [role] = await ctx.secureDb!.rls((tx) =>
        tx
          .update(jobRoles)
          .set({
            ...(input.title !== undefined && { title: input.title }),
            ...(input.jobDescription !== undefined && { jobDescription: input.jobDescription }),
          })
          .where(eq(jobRoles.id, input.id))
          .returning(),
      );
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
      return role;
    }),

  // ─── New procedures (split files) ─────────────────────────
  getActionsByCandidate,
  markFollowUpSent,
  updateCandidateOwner,
  updateCandidateScore,
  scoreCandidate,
});