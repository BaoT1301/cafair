import { authedProcedure } from "@/server/init";
import { candidates } from "../schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const updateCandidateScore = authedProcedure
  .input(
    z.object({
      candidateId: z.string(),
      fitScore: z.number().min(0).max(100),
      strengths: z.array(z.string()),
      gaps: z.array(z.string()),
      riskLevel: z.enum(["low", "medium", "high"]),
      summary: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.secureDb!.rls((tx) =>
      tx
        .update(candidates)
        .set({
          fitScore: input.fitScore,
          strengths: input.strengths,
          gaps: input.gaps,
          riskLevel: input.riskLevel,
          summary: input.summary,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, input.candidateId))
        .returning(),
    );
    return updated;
  });
