import { authedProcedure, createTRPCRouter, publicProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { usersRouter } from "@/services/users/procedures";
import { examplesRouter } from "@/services/examples/procedures";
import { uploadsRouter } from "@/services/uploads/procedures";
import { recruiterRouter } from "@/services/recruiter/procedures";

export const appRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      try {
        return {
          greeting: `Hello ${input.text}!`,
        };
      } catch (error) {
        console.error("Error in hello procedure:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),

  protectedHello: authedProcedure.query(({ ctx }) => {
    try {
      return {
        greeting: `Hello ${ctx.user.firstName ?? "User"}!`,
        userId: ctx.user.id,
      };
    } catch (error) {
      console.error("Error in protectedHello procedure:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }),

  // Service routers
  users: usersRouter,
  examples: examplesRouter,
  uploads: uploadsRouter,
  recruiter: recruiterRouter,
});

export type AppRouter = typeof appRouter;