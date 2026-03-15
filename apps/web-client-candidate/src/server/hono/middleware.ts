/**
 * Hono Auth Middleware — Clerk JWT verification for mobile clients
 *
 * Mobile clients send `Authorization: Bearer <clerk_session_jwt>` to authenticate.
 * This middleware verifies the JWT and attaches the userId to Hono's context.
 */

import { createMiddleware } from "hono/factory";
import { verifyToken } from "@clerk/backend";
import { HTTPException } from "hono/http-exception";

// ── Types ───────────────────────────────────────────────────────────────

export type AuthEnv = {
  Variables: {
    userId: string;
    apiKeyId?: string;
  };
};

// ── Keys ────────────────────────────────────────────────────────────────

const secretKey = process.env.CLERK_SECRET_KEY!;
const apiKeys = (process.env.API_KEYS ?? "")
  .split(",")
  .map((raw) => raw.trim())
  .filter(Boolean);

const isHealthPath = (path: string) =>
  path === "/api/mobile/health" || path === "/api/v1/health";

// ── Middleware ───────────────────────────────────────────────────────────

/**
 * Combined Clerk auth middleware — verifies JWT from Authorization header
 * and sets userId on the Hono context.
 *
 * Uses `@clerk/backend` `verifyToken` directly instead of `@hono/clerk-auth`
 * to have full control over the verification flow and error reporting.
 */
export const clerk = createMiddleware<AuthEnv>(async (c, next) => {
  // Skip auth for health check
  if (isHealthPath(c.req.path)) {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Unauthorized: missing Authorization header",
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, { secretKey });

    if (!payload.sub) {
      console.error("[auth] Token verified but no sub claim");
      throw new HTTPException(401, {
        message: "Unauthorized: token missing user identity",
      });
    }

    c.set("userId", payload.sub);
    await next();
  } catch (err: unknown) {
    // If it's already an HTTPException, re-throw
    if (err instanceof HTTPException) throw err;

    // Log the actual verification error for debugging
    console.error(
      "[auth] Token verification failed:",
      err instanceof Error ? err.message : err,
    );
    throw new HTTPException(401, {
      message: "Unauthorized: invalid or expired token",
    });
  }
});

export const requireApiKey = createMiddleware<AuthEnv>(async (c, next) => {
  const rawHeader = c.req.header("x-api-key") ?? c.req.header("X-API-Key");

  if (!rawHeader) {
    throw new HTTPException(401, {
      message: "Unauthorized: missing x-api-key header",
    });
  }

  if (apiKeys.length === 0) {
    throw new HTTPException(503, {
      message: "API key auth is not configured",
    });
  }

  const [providedKey, providedKeyId] = rawHeader.split(":");

  if (!providedKey || !apiKeys.includes(providedKey)) {
    throw new HTTPException(401, {
      message: "Unauthorized: invalid API key",
    });
  }

  c.set("apiKeyId", providedKeyId ?? "default");
  await next();
});

/**
 * requireAuth is now a no-op since `clerk` already sets userId.
 * Kept for backward compat so route files don't need changes.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  if (!c.get("userId")) {
    throw new HTTPException(401, {
      message: "Unauthorized: valid Clerk session required",
    });
  }
  await next();
});
