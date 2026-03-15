import { z } from "zod";

export const evidencePacketStageStatusSchema = z.enum([
  "ok",
  "partial",
  "blocked",
  "skipped",
]);

export const evidencePacketClaimSeveritySchema = z.enum([
  "verified",
  "info",
  "warning",
  "critical",
]);

export const evidencePacketClaimSourceSchema = z.enum([
  "linkedin",
  "github",
  "portfolio",
  "web",
  "system",
]);

export const evidencePacketClaimEvidenceSchema = z.object({
  source: evidencePacketClaimSourceSchema,
  quote: z.string().max(280).optional(),
  url: z.string().optional(),
  artifactPath: z.string().optional(),
});

export const evidencePacketClaimSchema = z.object({
  id: z.string().min(1),
  severity: evidencePacketClaimSeveritySchema,
  title: z.string().min(1).max(120),
  statement: z.string().min(1).max(280),
  rationale: z.string().max(280).optional(),
  evidence: z.array(evidencePacketClaimEvidenceSchema).min(1).max(8),
});

export const evidencePacketTraceStepSchema = z.object({
  t: z.string().optional(),
  stage: z.string().min(1).max(40),
  action: z.string().min(1).max(120),
  observed: z.string().min(1).max(280),
});

export const evidencePacketSchema = z.object({
  version: z.literal("1.0"),
  createdAtISO: z.string().min(1),
  candidate: z.object({
    label: z.string().min(1),
    candidateId: z.string().optional(),
  }),
  run: z.object({
    runDir: z.string().min(1),
    sessionId: z.string().optional(),
    actId: z.string().optional(),
    replayHtml: z.string().optional(),
  }),
  stageStatus: z.object({
    linkedin: evidencePacketStageStatusSchema,
    github: evidencePacketStageStatusSchema,
    portfolio: evidencePacketStageStatusSchema,
    web: evidencePacketStageStatusSchema,
  }),
  sources: z.object({
    linkedin: z
      .object({
        url: z.string().optional(),
        found: z.boolean().optional(),
      })
      .optional(),
    github: z
      .object({
        url: z.string().optional(),
        found: z.boolean().optional(),
      })
      .optional(),
    portfolio: z
      .object({
        url: z.string().optional(),
        found: z.boolean().optional(),
        ownerName: z.string().optional(),
      })
      .optional(),
    web: z
      .object({
        queries: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  flags: z.array(z.string()).max(40),
  claims: z.array(evidencePacketClaimSchema).max(12),
  novaReturn: z
    .object({
      rawTextPath: z.string().optional(),
      parsed: z.unknown().optional(),
      parseOk: z.boolean(),
    })
    .optional(),
  trace: z.object({
    mode: z.enum(["real", "synthetic"]),
    summary: z.string().min(1).max(400),
    steps: z.array(evidencePacketTraceStepSchema).min(1).max(80),
  }),
  metrics: z.object({
    thinkCount: z.number().int().nonnegative(),
    actionCounts: z.object({
      agentClick: z.number().int().nonnegative(),
      agentType: z.number().int().nonnegative(),
      agentScroll: z.number().int().nonnegative(),
      goToUrl: z.number().int().nonnegative(),
      return: z.number().int().nonnegative(),
    }),
    evidenceSnippetsCount: z.number().int().nonnegative(),
    claimsCount: z.number().int().nonnegative(),
  }),
  highlights: z.object({
    positives: z.array(z.string().max(280)).max(12),
    concerns: z.array(z.string().max(280)).max(12),
    missing: z.array(z.string().max(280)).max(12),
  }),
  bedrockInput: z.object({
    socialEvidencePacket: z.string().min(1).max(8000),
  }),
});

export type EvidencePacket = z.infer<typeof evidencePacketSchema>;
export type EvidencePacketClaim = z.infer<typeof evidencePacketClaimSchema>;
export type EvidencePacketStageStatus = z.infer<
  typeof evidencePacketStageStatusSchema
>;

