import { z } from "zod";

export const socialEvidenceCitationSchema = z.object({
  source: z.enum(["linkedin", "github", "portfolio", "web", "system"]),
  url: z.string().optional(),
  quote: z.string().optional(),
  artifactPath: z.string().optional(),
});

export const socialEvidenceFindingSchema = z.object({
  text: z.string().min(1).max(280),
  severity: z.enum(["info", "warning", "critical"]),
  citations: z.array(socialEvidenceCitationSchema).max(8),
});

export const socialEvidenceConcernSchema = z.object({
  text: z.string().min(1).max(280),
  severity: z.enum(["warning", "critical"]),
  citations: z.array(socialEvidenceCitationSchema).max(8).optional(),
});

export const socialEvidenceReasonerMetricsSchema = z.object({
  latencyMs: z.number().nonnegative().optional(),
  attempts: z.number().int().nonnegative().optional(),
  inputTokensEstimated: z.number().int().nonnegative().optional(),
  outputTokensEstimated: z.number().int().nonnegative().optional(),
  timestampISO: z.string().optional(),
  requestId: z.string().optional(),
});

export const recruiterSocialScreenFromEvidencePacketSchema = z.object({
  candidateId: z.string().optional(),
  candidateLabel: z.string().min(1),
  socialScore: z.number().min(0).max(100),
  risk: z.enum(["low", "medium", "high"]),
  recommendation: z.enum(["PROCEED", "REVIEW", "REJECT"]),
  verifiedFindings: z.array(socialEvidenceFindingSchema).max(12),
  concerns: z.array(socialEvidenceConcernSchema).max(12),
  nextSteps: z.array(z.string().min(1).max(280)).max(12),
  citations: z.array(socialEvidenceCitationSchema).max(24),
  flags: z.array(z.string()).max(40),
  stageStatus: z.object({
    linkedin: z.string(),
    github: z.string(),
    portfolio: z.string().optional(),
    web: z.string().optional(),
  }),
  provider: z.string().min(1),
  modelId: z.string().min(1),
  parseOk: z.boolean(),
  validationOk: z.boolean(),
  usedFallback: z.boolean(),
  degraded: z.boolean(),
  metrics: socialEvidenceReasonerMetricsSchema.optional(),
});

export type SocialEvidenceCitation = z.infer<typeof socialEvidenceCitationSchema>;
export type SocialEvidenceFinding = z.infer<typeof socialEvidenceFindingSchema>;
export type SocialEvidenceConcern = z.infer<typeof socialEvidenceConcernSchema>;
export type RecruiterSocialScreenFromEvidencePacket = z.infer<
  typeof recruiterSocialScreenFromEvidencePacketSchema
>;

