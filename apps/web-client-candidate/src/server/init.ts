import { db } from "@/db";
import { getSecureDb } from "@/db/secure-client";
import { currentUser } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";

/**
 * 1. Context Creation
 * This creates the context that is available to all procedures.
 */
export const createTRPCContext = cache(async () => {
  const user = await currentUser();

  let secureDb = null;
  if (user) {
    try {
      secureDb = await getSecureDb();
    } catch (error) {
      console.error(
        "[trpc-context] Failed to initialize secure DB:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    user,
    db,
    secureDb,
  };
});

/**
 * 2. tRPC Initialization
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

/**
 * 3. Exports
 */
export const createTRPCRouter = t.router;

// Public procedure - no auth required
export const publicProcedure = t.procedure;

// Authed procedure - requires authenticated user AND secure DB
export const authedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!opts.ctx.secureDb) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Secure database connection unavailable. Check Clerk Supabase JWT template configuration.",
    });
  }
  return opts.next({
    ctx: { ...opts.ctx, user: opts.ctx.user, secureDb: opts.ctx.secureDb },
  });
});
