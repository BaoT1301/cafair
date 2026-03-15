/**
 * Hono API — Shared Root Application
 *
 * Single Hono root serving both:
 * - REST endpoints (/api/v1/*, /api/mobile/* compatibility)
 * - tRPC endpoint (/api/trpc/*)
 *
 * Provides one middleware chain for logging/CORS/error handling.
 */

import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";

import { createTRPCContext } from "@/server/init";
import { appRouter } from "@/server/routers/app";
import { clerk, requireAuth, type AuthEnv } from "./middleware";
import usersRoutes from "./routes/users";
import examplesRoutes from "./routes/examples";
import uploadsRoutes from "./routes/uploads";

const app = new Hono<AuthEnv>();

const mountRestApi = ({
  basePath,
  service,
}: {
  basePath: "/api/v1" | "/api/mobile";
  service: string;
}) => {
  app.get(`${basePath}/health`, (c) =>
    c.json({
      status: "ok",
      service,
      basePath,
      timestamp: new Date().toISOString(),
    }),
  );

  app.use(`${basePath}/*`, clerk);
  app.use(`${basePath}/*`, requireAuth);

  app.route(`${basePath}/users`, usersRoutes);
  app.route(`${basePath}/examples`, examplesRoutes);
  app.route(`${basePath}/uploads`, uploadsRoutes);
};

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
    maxAge: 86400,
  }),
);

mountRestApi({
  basePath: "/api/v1",
  service: "public-api-v1",
});

mountRestApi({
  basePath: "/api/mobile",
  service: "mobile-api-compat",
});

app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext: async () => createTRPCContext(),
  }),
);

app.onError((err, c) => {
  console.error("[api-root]", err);

  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  return c.json(
    { error: err instanceof Error ? err.message : "Internal server error" },
    500,
  );
});

app.notFound((c) => c.json({ error: "Not found", path: c.req.path }, 404));

export default app;
