import { authedProcedure } from "@/server/init";
import { users } from "../schema";
import { eq } from "drizzle-orm";

export const getMe = authedProcedure.query(async ({ ctx }) => {
  const [user] = await ctx.secureDb!.rls(async (tx) => {
    return tx.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
  });
  return user ?? null;
});
