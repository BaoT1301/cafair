import { authedProcedure } from "@/server/init";
import { recruiterActions } from "../schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const markFollowUpSent = authedProcedure
  .input(z.object({ actionId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.secureDb!.rls((tx) =>
      tx
        .update(recruiterActions)
        .set({ status: "success" })
        .where(eq(recruiterActions.id, input.actionId))
        .returning(),
    );
    return updated;
  });
