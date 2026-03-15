/**
 * Users — Mobile REST routes
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/services/users/schema";
import type { AuthEnv } from "../middleware";
import { clerkClient } from "@clerk/nextjs/server";

const app = new Hono<AuthEnv>();

// GET /users/me
app.get("/me", async (c) => {
  const userId = c.var.userId;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return c.json({ data: user ?? null });
});

// PATCH /users/me
app.patch("/me", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{
    firstName?: string;
    lastName?: string;
  }>();

  const [updated] = await db
    .update(users)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  return c.json({ data: updated });
});

// POST /users/sync — sync Clerk user data to DB
app.post("/sync", async (c) => {
  const userId = c.var.userId;
  let body:
    | {
        email?: string;
        firstName?: string;
        lastName?: string;
        imageUrl?: string;
      }
    | undefined;

  // Mobile clients may call /users/sync with no body; tolerate that and
  // fetch profile from Clerk on the server.
  try {
    body = await c.req.json();
  } catch {
    body = undefined;
  }

  let email = body?.email;
  let firstName = body?.firstName;
  let lastName = body?.lastName;
  let imageUrl = body?.imageUrl;

  if (!email) {
    try {
      const client = await clerkClient();
      const u = await client.users.getUser(userId);
      email =
        u.primaryEmailAddress?.emailAddress ??
        u.emailAddresses?.[0]?.emailAddress ??
        undefined;
      firstName = firstName ?? u.firstName ?? undefined;
      lastName = lastName ?? u.lastName ?? undefined;
      imageUrl = imageUrl ?? u.imageUrl ?? undefined;
    } catch {
      // ignore
    }
  }

  // Ensure required email constraint is satisfied (and unique in dev)
  email = email ?? `${userId}@placeholder.local`;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email: email ?? existing.email,
        firstName,
        lastName,
        imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return c.json({ data: updated });
  }

  const [newUser] = await db
    .insert(users)
    .values({
      id: userId,
      email,
      firstName,
      lastName,
      imageUrl,
    })
    .returning();

  return c.json({ data: newUser }, 201);
});

export default app;
