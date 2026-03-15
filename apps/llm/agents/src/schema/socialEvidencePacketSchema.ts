import { z } from "zod";

export const packetStageStatusSchema = z.enum([
  "ok",
  "partial",
  "skipped",
  "failed",
]);

export const evidenceSourceSchema = z.enum([
  "linkedin",
  "github",
  "portfolio",
  "web",
  "trace",
  "returnBlock",
]);

export const claimCategorySchema = z.enum([
  "identity",
  "employment",
  "education",
  "skills",
  "activity",
  "projects",
  "risk",
  "other",
]);

export const claimConfidenceSchema = z.enum(["high", "medium", "low"]);
export const claimSeveritySchema = z.enum(["info", "warning", "critical"]);

export const packetEvidenceRefSchema = z.object({
  source: evidenceSourceSchema,
  snippet: z.string().min(1).max(280),
  lineRef: z.string().optional(),
  url: z.string().optional(),
});

export const packetClaimSchema = z.object({
  id: z.string().min(1),
  category: claimCategorySchema,
  claim: z.string().min(1).max(280),
  evidence: z.array(packetEvidenceRefSchema).min(1),
  confidence: claimConfidenceSchema,
  severity: claimSeveritySchema.optional(),
});

export const packetTimelineItemSchema = z.object({
  t: z.string().optional(),
  kind: z.enum(["think", "action", "return"]),
  text: z.string().min(1).max(280),
});

export const packetMetricsSchema = z.object({
  thinkCount: z.number().int().nonnegative(),
  returnCount: z.number().int().nonnegative(),
  actionCounts: z.object({
    agentClick: z.number().int().nonnegative(),
    agentType: z.number().int().nonnegative(),
    agentScroll: z.number().int().nonnegative(),
    goToUrl: z.number().int().nonnegative(),
  }),
  timeline: z.array(packetTimelineItemSchema).max(200),
  actedUrls: z.array(z.string()).max(100),
});

export const packetSourceSchema = z.object({
  url: z.string().optional(),
  queries: z.array(z.string()).optional(),
});

export const socialEvidencePacketSchema = z.object({
  ok: z.boolean(),
  packetVersion: z.literal("v1"),
  candidateLabel: z.string().min(1),
  run: z.object({
    runDir: z.string().min(1),
    createdAtISO: z.string().min(1),
    sessionId: z.string().optional(),
    actId: z.string().optional(),
  }),
  sources: z.object({
    linkedin: packetSourceSchema.optional(),
    github: packetSourceSchema.optional(),
    portfolio: packetSourceSchema.optional(),
    web: packetSourceSchema.optional(),
  }),
  stageStatus: z.object({
    linkedin: packetStageStatusSchema,
    github: packetStageStatusSchema,
    portfolio: packetStageStatusSchema,
    web: packetStageStatusSchema.optional(),
  }),
  flags: z.array(z.string()).max(40),
  metrics: packetMetricsSchema,
  claims: z.array(packetClaimSchema).max(40),
  highlights: z.object({
    positives: z.array(z.string().max(280)).max(12),
    concerns: z.array(z.string().max(280)).max(12),
    missing: z.array(z.string().max(280)).max(12),
  }),
  rawRefs: z.object({
    captureJsonPath: z.string().min(1),
    tracePath: z.string().min(1),
    returnBlockPath: z.string().min(1),
    replayHtmlPath: z.string().optional(),
  }),
});

export type SocialEvidencePacket = z.infer<typeof socialEvidencePacketSchema>;
export type PacketClaim = z.infer<typeof packetClaimSchema>;
