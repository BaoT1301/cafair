import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { Hono } from "hono";

const app = new Hono()
  .get("/", clerkMiddleware(), (c) => {
    const auth = getAuth(c);

    if (!auth?.userId) {
      return c.json({
        error: "Unauthorized",
        message: "You are not logged in.",
      });
    }

    return c.json({
      message: "You are logged in!",
      userId: auth.userId,
      status: "ok",
    });
  })
  .get("/ping", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

export default app;
