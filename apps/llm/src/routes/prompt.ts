/**
 * Prompt Routes — Core API for structured LLM interactions
 *
 * POST /api/prompt/run           — Run a registered template by name
 * POST /api/prompt/raw           — Run a raw formatted prompt
 * GET  /api/prompt/templates     — List available templates
 */

import { Router } from "express";
import { z } from "zod";
import { generateFromPrompt, generateJSON, generateJSONWithRetry } from "../lib/gemini.js";
import { generateNovaJSON, generateNovaJSONWithRetry } from "../lib/nova.js";
import { formatPrompt } from "../lib/prompt-formatter.js";
import {
  PROMPT_TEMPLATES,
  AVAILABLE_TEMPLATES,
  type TemplateName,
} from "../lib/prompt-templates.js";
import { getCachedResponse, setCachedResponse } from "../lib/redis.js";

const router = Router();

// ──────────────────────────────────────────────────────────────────────────
// POST /run — Execute a registered prompt template
// ──────────────────────────────────────────────────────────────────────────

const runTemplateSchema = z.object({
  template: z.enum(AVAILABLE_TEMPLATES as [string, ...string[]]),
  input: z.record(z.string(), z.unknown()),
  context: z.record(z.string(), z.unknown()).optional(),
  parseJson: z.boolean().optional().default(true),
  cache: z.boolean().optional().default(true),
});

router.post("/run", async (req, res) => {
  try {
    const { template, input, context, parseJson, cache } =
      runTemplateSchema.parse(req.body);

    const templateFn = PROMPT_TEMPLATES[template as TemplateName];
    const prompt = templateFn(input, context);

    // Check cache
    if (cache) {
      const cached = await getCachedResponse(prompt);
      if (cached) {
        res.json({
          data: parseJson ? JSON.parse(cached) : cached,
          meta: { template, cached: true },
        });
        return;
      }
    }

    // Call LLM
    const startTime = Date.now();
    let data: unknown;
    let provider: string;
    const forceProvider = (process.env.FORCE_LLM_PROVIDER ?? "auto").toLowerCase();

    if (forceProvider === "nova") {
      console.log(`→ POST /api/prompt/run [${template}] via Nova (forced)`);
      data = parseJson ? await generateNovaJSONWithRetry(prompt) : await generateNovaJSON(prompt);
      provider = "nova";
    } else if (forceProvider === "gemini") {
      console.log(`→ POST /api/prompt/run [${template}] via Gemini (forced)`);
      data = parseJson ? await generateJSONWithRetry(prompt) : await generateFromPrompt(prompt);
      provider = "gemini";
    } else {
      try {
        console.log(`→ POST /api/prompt/run [${template}] via Nova...`);
        data = parseJson ? await generateNovaJSONWithRetry(prompt) : await generateNovaJSON(prompt);
        provider = "nova";
      } catch (novaErr) {
        console.warn(`⚠ Nova failed, falling back to Gemini: ${(novaErr as Error).message}`);
        data = parseJson ? await generateJSONWithRetry(prompt) : await generateFromPrompt(prompt);
        provider = "gemini";
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✓ /api/prompt/run [${template}] completed via ${provider} in ${duration}ms`);

    // Cache the response
    if (cache) {
      await setCachedResponse(
        prompt,
        typeof data === "string" ? data : JSON.stringify(data),
      );
    }

    res.json({
      data,
      meta: { template, cached: false, durationMs: duration, provider },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid request",
        details: error.issues,
        availableTemplates: AVAILABLE_TEMPLATES,
      });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(422).json({
        error: "LLM returned invalid JSON",
        message: error.message,
      });
      return;
    }
    throw error;
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /raw — Execute a custom formatted prompt (advanced usage)
// ──────────────────────────────────────────────────────────────────────────

const rawPromptSchema = z.object({
  role: z.string().min(1),
  task: z.string().min(1),
  rules: z.array(z.string()).default([]),
  input: z.record(z.string(), z.unknown()),
  output: z.union([z.record(z.string(), z.unknown()), z.string()]),
  context: z.record(z.string(), z.unknown()).optional(),
  examples: z
    .array(
      z.object({
        input: z.record(z.string(), z.unknown()),
        output: z.unknown(),
      }),
    )
    .optional(),
  parseJson: z.boolean().optional().default(true),
  cache: z.boolean().optional().default(false),
});

router.post("/raw", async (req, res) => {
  try {
    const body = rawPromptSchema.parse(req.body);
    const prompt = formatPrompt({
      ...body,
      examples: body.examples?.map((example) => ({
        input: example.input,
        output: example.output ?? null,
      })),
    });

    // Check cache
    if (body.cache) {
      const cached = await getCachedResponse(prompt);
      if (cached) {
        res.json({
          data: body.parseJson ? JSON.parse(cached) : cached,
          meta: { cached: true },
        });
        return;
      }
    }

    const startTime = Date.now();
    let data: unknown;
    let provider: string;
    const forceProvider = (process.env.FORCE_LLM_PROVIDER ?? "auto").toLowerCase();

    if (forceProvider === "nova") {
      console.log(`→ POST /api/prompt/raw via Nova (forced)`);
      data = body.parseJson ? await generateNovaJSONWithRetry(prompt) : await generateNovaJSON(prompt);
      provider = "nova";
    } else if (forceProvider === "gemini") {
      console.log(`→ POST /api/prompt/raw via Gemini (forced)`);
      data = body.parseJson ? await generateJSONWithRetry(prompt) : await generateFromPrompt(prompt);
      provider = "gemini";
    } else {
      // auto: Nova → Gemini fallback
      try {
        console.log(`→ POST /api/prompt/raw via Nova...`);
        data = body.parseJson ? await generateNovaJSONWithRetry(prompt) : await generateNovaJSON(prompt);
        provider = "nova";
      } catch (novaErr) {
        console.warn(`⚠ Nova failed, falling back to Gemini: ${(novaErr as Error).message}`);
        data = body.parseJson ? await generateJSONWithRetry(prompt) : await generateFromPrompt(prompt);
        provider = "gemini";
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✓ /api/prompt/raw completed via ${provider} in ${duration}ms`);

    if (body.cache) {
      await setCachedResponse(
        prompt,
        typeof data === "string" ? data : JSON.stringify(data),
      );
    }

    res.json({
      data,
      meta: { cached: false, durationMs: duration, provider },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.issues });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(422).json({
        error: "LLM returned invalid JSON",
        message: error.message,
      });
      return;
    }
    throw error;
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /templates — List all available prompt templates
// ──────────────────────────────────────────────────────────────────────────

router.get("/templates", (_req, res) => {
  res.json({
    templates: AVAILABLE_TEMPLATES,
    count: AVAILABLE_TEMPLATES.length,
  });
});

export default router;
