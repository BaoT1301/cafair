/**
 * Examples — Mobile REST routes (CRUD)
 */

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { examples } from "@/services/examples/schema";
import type { AuthEnv } from "../middleware";

const app = new Hono<AuthEnv>();

// GET /examples — list my examples
app.get("/", async (c) => {
  const userId = c.var.userId;
  const rows = await db
    .select()
    .from(examples)
    .where(eq(examples.userId, userId))
    .orderBy(desc(examples.createdAt));
  return c.json({ data: rows });
});

// GET /examples/public — list all public examples
app.get("/public", async (c) => {
  const rows = await db
    .select()
    .from(examples)
    .where(eq(examples.isPublic, true))
    .orderBy(desc(examples.createdAt));
  return c.json({ data: rows });
});

// GET /examples/:id
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [example] = await db
    .select()
    .from(examples)
    .where(eq(examples.id, id))
    .limit(1);
  return c.json({ data: example ?? null });
});

// POST /examples
app.post("/", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{
    title: string;
    description?: string;
    isPublic?: boolean;
  }>();

  const [created] = await db
    .insert(examples)
    .values({
      userId,
      title: body.title,
      description: body.description,
      isPublic: body.isPublic ?? false,
    })
    .returning();

  return c.json({ data: created }, 201);
});

// PATCH /examples/:id
app.patch("/:id", async (c) => {
  const userId = c.var.userId;
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    description?: string;
    isPublic?: boolean;
  }>();

  const [updated] = await db
    .update(examples)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(examples.id, id), eq(examples.userId, userId)))
    .returning();

  return c.json({ data: updated });
});

// DELETE /examples/:id
app.delete("/:id", async (c) => {
  const userId = c.var.userId;
  const id = c.req.param("id");

  await db
    .delete(examples)
    .where(and(eq(examples.id, id), eq(examples.userId, userId)));

  return c.json({ success: true });
});

export default app;
