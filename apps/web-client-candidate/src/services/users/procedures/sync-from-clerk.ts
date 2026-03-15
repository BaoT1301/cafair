import { authedProcedure } from "@/server/init";
import { users } from "../schema";
import { eq } from "drizzle-orm";

export const syncFromClerk = authedProcedure.mutation(async ({ ctx }) => {
  const clerkUser = ctx.user;

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
