/**
 * tRPC Next.js Route Handler
 *
 * Uses the tRPC fetch adapter directly (not Hono) so that Next.js's
 * AsyncLocalStorage context is preserved. This lets Clerk's currentUser()
 * and headers() work correctly inside tRPC procedures.
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/app";
import { createTRPCContext } from "@/server/init";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
  });

export const GET = handler;
export const POST = handler;
