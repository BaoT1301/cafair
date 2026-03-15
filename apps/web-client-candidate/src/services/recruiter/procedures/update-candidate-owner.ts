import { authedProcedure } from "@/server/init";
import { candidates } from "../schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const updateCandidateOwner = authedProcedure
  .input(
    z.object({
      candidateId: z.string(),
      ownerId: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.secureDb!.rls((tx) =>
      tx
        .update(candidates)
        .set({ ownerId: input.ownerId, updatedAt: new Date() })
        .where(eq(candidates.id, input.candidateId))
        .returning(),
    );
    return updated;
  });
