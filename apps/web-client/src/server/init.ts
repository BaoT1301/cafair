import { db } from "@/db";
import { getSecureDb, getServiceDb } from "@/db/secure-client";
import { auth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";

async function buildContext() {
  // auth() reads from request headers set by Clerk middleware — no network call,
  // reliable in all Next.js contexts (RSC, Route Handlers, Hono handlers).
  const { userId } = await auth();

  const user = userId ? { id: userId } : null;

  let secureDb = null;
  if (userId) {
    try {
      secureDb = await getSecureDb();
    } catch {
      // Clerk JWT template misconfigured — fall back to service role
      secureDb = getServiceDb();
    }
  }

  return { user, db, secureDb };
}

/**
 * 1. Context Creation
 *
 * Two variants:
 * - createTRPCContext  — wrapped in React.cache() for server components (dedupes within a render)
 * - createHonoTRPCContext — fresh call per request, for use in the Hono HTTP handler
 */
export const createTRPCContext = cache(buildContext);

/** Use this in the Hono tRPC handler — never wraps with React.cache() */
export const createHonoTRPCContext = buildContext;

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

// Authed procedure - requires authenticated user, secureDb optional (falls back to db)
export const authedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({
    ctx: { ...opts.ctx, user: opts.ctx.user },
  });
});

// DB procedure - requires auth but uses ctx.db directly (bypasses RLS).
// Use this for mutations that write to seeded/shared data where RLS would block.
export const dbProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({
    ctx: { ...opts.ctx, user: opts.ctx.user },
  });
});
