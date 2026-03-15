import { authedProcedure } from "@/server/init";
import { z } from "zod";
import { users } from "../schema";
import { eq } from "drizzle-orm";

export const updateProfile = authedProcedure
  .input(
    z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.secureDb!.rls(async (tx) => {
      return tx
        .update(users)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id))
        .returning();
    });
    return updated;
  });
