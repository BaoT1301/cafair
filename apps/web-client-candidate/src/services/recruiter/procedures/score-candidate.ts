import { authedProcedure } from "@/server/init";
import { candidates } from "../schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

/**
 * Server-side orchestrator: calls the LLM /score endpoint,
 * then persists the result into the candidates table.
 * Frontend fires ONE mutation — no direct LLM calls needed.
 */

const novaScoreSchema = z.object({
  fit_score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  risk_level: z.enum(["low", "medium", "high"]),
  summary: z.string(),
});

export const scoreCandidate = authedProcedure
  .input(
    z.object({
      candidateId: z.string(),
      resume: z.string(),
      jobDescription: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // ── Step 1: Call LLM service ─────────────────────────
    const llmUrl = process.env.LLM_URL ?? "http://localhost:3001";

    let scoreResult: z.infer<typeof novaScoreSchema>;

    try {
      const response = await fetch(`${llmUrl}/api/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: input.candidateId,
          resume: input.resume,
          jobDescription: input.jobDescription,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`LLM responded ${response.status}: ${errorBody}`);
      }

      const json = await response.json();

      // The /score endpoint returns { success, candidateId, ...scores }
      scoreResult = novaScoreSchema.parse({
        fit_score: json.fit_score,
        strengths: json.strengths,
        gaps: json.gaps,
        risk_level: json.risk_level,
        summary: json.summary,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown LLM error";
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Nova scoring failed: ${message}`,
      });
    }

    // ── Step 2: Persist to DB ────────────────────────────
    const [updated] = await ctx.secureDb!.rls((tx) =>
      tx
        .update(candidates)
        .set({
          fitScore: scoreResult.fit_score,
          strengths: scoreResult.strengths,
          gaps: scoreResult.gaps,
          riskLevel: scoreResult.risk_level,
          summary: scoreResult.summary,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, input.candidateId))
        .returning(),
    );

    return updated;
  });
