import { authedProcedure } from "@/server/init";
import { currentUser } from "@clerk/nextjs/server";
import { users } from "../schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const syncFromClerk = authedProcedure.mutation(async ({ ctx }) => {
  // Fetch full Clerk user data within this procedure (ctx.user only has id)
  const clerkUser = await currentUser();
  if (!clerkUser) throw new TRPCError({ code: "UNAUTHORIZED" });

  const [existing] = await ctx.db
    .select()
    .from(users)
    .where(eq(users.id, clerkUser.id))
    .limit(1);

  if (existing) {
    const [updated] = await ctx.db
      .update(users)
      .set({
        email: clerkUser.emailAddresses[0]?.emailAddress ?? existing.email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, clerkUser.id))
      .returning();
    return updated;
  }

  const [newUser] = await ctx.db
    .insert(users)
    .values({
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
    })
    .returning();
  return newUser;
});
