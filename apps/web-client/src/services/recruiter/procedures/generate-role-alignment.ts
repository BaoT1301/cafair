import { authedProcedure } from "@/server/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

/**
 * generateRoleAlignment — Calls the LLM service to produce structured
 * recruiting criteria from a job description. Returns criteria weights,
 * dealbreakers, interview focus areas, experience range, decision thresholds,
 * and risk tolerance — ready to populate the Role Alignment setup page.
 */

const alignmentOutputSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string(),
      weight: z.number().min(0).max(100),
      mustHave: z.boolean(),
    }),
  ),
  dealbreakers: z.array(z.string()),
  interviewFocusAreas: z.array(z.string()),
  experienceRange: z.object({
    min: z.number(),
    max: z.number(),
    autoReject: z.boolean(),
  }),
  thresholds: z.object({
    advance: z.number(),
    review: z.number(),
    reject: z.number(),
    autoReject: z.boolean(),
  }),
  riskTolerance: z.number().min(0).max(100),
});

export type RoleAlignmentOutput = z.infer<typeof alignmentOutputSchema>;

export const generateRoleAlignment = authedProcedure
  .input(
    z.object({
      jobDescription: z.string().min(20, "Job description must be at least 20 characters"),
      roleTitle: z.string().min(1),
    }),
  )
  .mutation(async ({ input }) => {
    const llmUrl = process.env.LLM_URL ?? "http://localhost:3001";

    let rawData: unknown;

    try {
      const response = await fetch(`${llmUrl}/api/prompt/raw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "Expert AI recruiting assistant specializing in structured hiring criteria extraction",
          task: `Analyze the provided job description for the role "${input.roleTitle}" and extract structured recruiting criteria for a career fair. You must return ONLY a valid JSON object — no markdown, no backticks, no explanation text.`,
          rules: [
            "Return ONLY a valid JSON object matching the exact output schema — no extra fields",
            "criteria must have 5 to 8 items covering the most important skills and qualities",
            "Each criterion weight must be an integer between 50 and 100",
            "Mark mustHave: true only for absolute requirements listed in the job description",
            "dealbreakers must have 3 to 5 items that would immediately disqualify a candidate",
            "interviewFocusAreas must have 3 to 5 specific topic areas to probe during interviews",
            "experienceRange.min and max are years of relevant experience (integers)",
            "thresholds: advance is the minimum fit score to advance (70-90), review is borderline (55-75), reject is below this (40-65)",
            "riskTolerance is how much uncertainty is acceptable: 0=very conservative, 100=very flexible (typically 30-60 for most roles)",
            "autoReject defaults to false",
            "Base all values strictly on the job description content — do not invent requirements",
          ],
          input: {
            roleTitle: input.roleTitle,
            jobDescription: input.jobDescription,
          },
          output: {
            criteria: [
              { name: "string — skill or quality name", weight: "number 50-100", mustHave: "boolean" },
            ],
            dealbreakers: ["string — disqualifying condition"],
            interviewFocusAreas: ["string — topic area to probe"],
            experienceRange: { min: "number", max: "number", autoReject: false },
            thresholds: { advance: "number 70-90", review: "number 55-75", reject: "number 40-65", autoReject: false },
            riskTolerance: "number 0-100",
          },
          examples: [
            {
              input: {
                roleTitle: "Senior Frontend Engineer",
                jobDescription: "We need a React expert with TypeScript, 4+ years experience, system design skills, and strong communication. Must have CS degree. Nice to have: GraphQL, testing.",
              },
              output: {
                criteria: [
                  { name: "React", weight: 95, mustHave: true },
                  { name: "TypeScript", weight: 90, mustHave: true },
                  { name: "System Design", weight: 80, mustHave: false },
                  { name: "Communication", weight: 75, mustHave: false },
                  { name: "GraphQL", weight: 60, mustHave: false },
                  { name: "Testing", weight: 65, mustHave: false },
                ],
                dealbreakers: [
                  "Less than 4 years of frontend experience",
                  "No CS degree or equivalent",
                  "No React production experience",
                ],
                interviewFocusAreas: [
                  "React architecture and state management",
                  "TypeScript advanced patterns",
                  "System design for scalable UIs",
                  "Communication and collaboration",
                ],
                experienceRange: { min: 4, max: 8, autoReject: false },
                thresholds: { advance: 82, review: 68, reject: 55, autoReject: false },
                riskTolerance: 35,
              },
            },
          ],
          parseJson: true,
          cache: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM service responded ${response.status}: ${errorText}`);
      }

      const json = await response.json();
      rawData = json.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `AI analysis failed: ${msg}. Make sure the LLM service is running (cd apps/llm && npm run dev).`,
      });
    }

    // Validate the shape
    const parsed = alignmentOutputSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `AI returned unexpected structure: ${JSON.stringify(parsed.error.flatten())}`,
      });
    }

    return parsed.data;
  });
