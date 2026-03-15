/**
 * POST /api/score — Candidate Scoring via Bedrock/Nova (with Gemini fallback)
 *
 * Accepts candidate resume + job description, returns a structured fit assessment.
 * Does NOT update the database — the web-client persists via tRPC `scoreCandidate`.
 *
 * Provider resolution:
 *   FORCE_LLM_PROVIDER=bedrock|nova → Bedrock/Nova only (fail if unavailable)
 *   FORCE_LLM_PROVIDER=gemini → Gemini only
 *   FORCE_LLM_PROVIDER=auto   → Bedrock first, Gemini fallback (default)
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { formatPrompt } from "../lib/prompt-formatter.js";
import { generateJSONWithRetry } from "../lib/gemini.js";
import { scoreCandidateWithBedrock } from "../lib/candidate-score-bedrock.js";
import { getCachedResponse, setCachedResponse } from "../lib/redis.js";
import crypto from "crypto";

const router = Router();

// ─── Input / Output schemas ──────────────────────────────

const scoreInputSchema = z.object({
  candidateId: z.string(),
  resume: z.string().min(1, "Resume text is required"),
  jobDescription: z.string().min(1, "Job description is required"),
});

const scoreOutputSchema = z.object({
  fit_score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  risk_level: z.enum(["low", "medium", "high"]),
  summary: z.string(),
});

const cachedScoreSchema = z.object({
  provider: z.string(),
  data: scoreOutputSchema,
});

// ─── Cache helper ────────────────────────────────────────

function buildCacheKey(
  candidateId: string,
  resume: string,
  jobDescription: string,
): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${candidateId}|${resume}|${jobDescription}`)
    .digest("hex");
  return `llm:score:${hash}`;
}

// ─── POST / ──────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate input
    const parsed = scoreInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { candidateId, resume, jobDescription } = parsed.data;

    // Check cache
    const cacheKey = buildCacheKey(candidateId, resume, jobDescription);
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      console.log(`✓ Cache hit for candidate ${candidateId}`);
      const parsedCache = cachedScoreSchema.safeParse(JSON.parse(cached));

      if (parsedCache.success) {
        res.json({
          success: true,
          candidateId,
          cached: true,
          provider: parsedCache.data.provider,
          ...parsedCache.data.data,
        });
        return;
      }

      console.warn(
        `⚠ Legacy score cache payload for candidate ${candidateId}; provider unavailable.`,
      );
      const legacyCache = scoreOutputSchema.parse(JSON.parse(cached));
      res.json({
        success: true,
        candidateId,
        cached: true,
        provider: "unknown-cache",
        ...legacyCache,
      });
      return;
    }

    // Build structured prompt
    const prompt = formatPrompt({
      role: "Expert technical recruiter and talent evaluator with deep knowledge of engineering roles, skill assessment, and hiring best practices",
      task: "Evaluate how well this candidate fits the given job description. Assess their strengths, identify gaps, determine risk level, and provide an overall fit score.",
      rules: [
        "Return ONLY a valid JSON object — no markdown, no backticks, no explanation",
        "fit_score must be an integer between 0 and 100",
        "strengths must be an array of 2-5 specific, evidence-based strengths from the resume",
        "gaps must be an array of 1-4 specific skill or experience gaps relative to the job description",
        'risk_level must be exactly "low", "medium", or "high"',
        "summary must be 2-3 sentences synthesizing the overall assessment",
        "Be objective and evidence-based — only cite skills/experience actually present in the resume",
      ],
      input: {
        resume,
        jobDescription,
      },
      output: {
        fit_score: "number (0-100)",
        strengths: ["string — specific skills or experience"],
        gaps: ["string — missing requirements"],
        risk_level: "low | medium | high",
        summary: "string — 2-3 sentence synthesis",
      },
      examples: [
        {
          input: {
            resume:
              "3 years Python, PyTorch, published NeurIPS paper, no industry experience",
            jobDescription:
              "ML Engineer: requires Python, PyTorch, 2+ years production ML",
          },
          output: {
            fit_score: 72,
            strengths: [
              "Strong Python and PyTorch skills",
              "Research depth with NeurIPS publication",
            ],
            gaps: ["No production ML deployment experience"],
            risk_level: "medium",
            summary:
              "Strong academic ML background with relevant framework experience. The lack of production deployment experience is a notable gap but trainable given research depth.",
          },
        },
      ],
    });

    // Determine LLM provider
    const forceProvider = (
      process.env.FORCE_LLM_PROVIDER ?? "auto"
    ).toLowerCase();
    console.log(
      JSON.stringify({
        type: "score_provider_selection",
        candidateId,
        forceProvider,
        useRealBedrock: process.env.USE_REAL_BEDROCK ?? null,
        bedrockModelId:
          process.env.BEDROCK_MODEL_ID ?? process.env.NOVA_MODEL_ID ?? null,
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        redisEnabled: Boolean(process.env.REDIS_URL),
        cacheKey,
      }),
    );

    let rawResult: unknown;
    let provider: string;

    if (forceProvider === "gemini") {
      // ── Gemini only ─────────────────────────────────────
      console.log(`→ Scoring candidate ${candidateId} via Gemini (forced)...`);
      rawResult = await generateJSONWithRetry<unknown>(prompt);
      provider = "gemini";
    } else if (forceProvider === "nova" || forceProvider === "bedrock") {
      // ── Bedrock only ────────────────────────────────────
      console.log(`→ Scoring candidate ${candidateId} via Bedrock (forced)...`);
      const bedrockResult = await scoreCandidateWithBedrock({
        candidateId,
        resumeText: resume,
        jobDescription,
      });

      if (bedrockResult.provider === "stub") {
        throw new Error(
          "Bedrock scoring resolved to stub mode. Enable USE_REAL_BEDROCK or use Gemini.",
        );
      }

      rawResult = bedrockResult;
      provider = bedrockResult.provider;
    } else {
      // ── Auto: Bedrock → Gemini fallback ────────────────
      try {
        console.log(`→ Scoring candidate ${candidateId} via Bedrock...`);
        const bedrockResult = await scoreCandidateWithBedrock({
          candidateId,
          resumeText: resume,
          jobDescription,
        });

        if (bedrockResult.provider === "stub") {
          throw new Error(
            "Bedrock scoring resolved to stub mode. Falling back to Gemini.",
          );
        }

        rawResult = bedrockResult;
        provider = bedrockResult.provider;
      } catch (bedrockErr) {
        console.warn(
          `⚠ Bedrock failed for candidate ${candidateId}, falling back to Gemini:`,
          (bedrockErr as Error).message,
        );
        rawResult = await generateJSONWithRetry<unknown>(prompt);
        provider = "gemini";
      }
    }

    // Validate output schema
    const validated = scoreOutputSchema.safeParse(rawResult);
    if (!validated.success) {
      console.error(
        `${provider} returned invalid schema:`,
        validated.error.flatten(),
      );
      res.status(502).json({
        error: "LLM returned invalid response schema",
        details: validated.error.flatten(),
        provider,
      });
      return;
    }

    // Cache the result (1 hour default)
    await setCachedResponse(
      cacheKey,
      JSON.stringify({
        provider,
        data: validated.data,
      }),
    );

    console.log(
      `✓ Scored candidate ${candidateId} via ${provider}: fit_score=${validated.data.fit_score}, risk=${validated.data.risk_level}`,
    );

    res.json({
      success: true,
      candidateId,
      provider,
      ...validated.data,
    });
  } catch (err) {
    console.error("❌ Score endpoint error:", err);
    res.status(500).json({
      error: "Scoring failed",
      message:
        process.env.NODE_ENV === "development"
          ? (err as Error).message
          : undefined,
    });
  }
});

export default router;
