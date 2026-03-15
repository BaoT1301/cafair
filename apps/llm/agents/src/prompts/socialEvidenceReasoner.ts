import type { EvidencePacket } from "../schema/evidencePacketSchema.js";

export interface SocialEvidenceReasonerPromptInput {
  evidencePacket: EvidencePacket;
  roleTitle?: string;
  companyName?: string;
}

export interface SocialEvidenceReasonerPromptBundle {
  feature: "social_evidence_reasoner";
  system: string;
  prompt: string;
  schemaHint: string;
}

function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildSocialEvidenceReasonerPrompt(
  input: SocialEvidenceReasonerPromptInput,
): SocialEvidenceReasonerPromptBundle {
  const roleContext = [
    input.roleTitle ? `Role Title: ${input.roleTitle}` : null,
    input.companyName ? `Company Name: ${input.companyName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const schemaHint = compactJson({
    candidateLabel: input.evidencePacket.candidate.label,
    socialScore: 72,
    risk: "medium",
    recommendation: "REVIEW",
    verifiedFindings: [
      {
        text: "GitHub profile is visible but partial.",
        severity: "info",
        citations: [
          {
            source: "github",
            url: input.evidencePacket.sources.github?.url,
            quote: "Github stage status: partial.",
            artifactPath: `${input.evidencePacket.run.runDir}/evidence_packet.json`,
          },
        ],
      },
    ],
    concerns: [
      {
        text: "Portfolio appears owned by a different person.",
        severity: "critical",
        citations: [
          {
            source: "portfolio",
            url: input.evidencePacket.sources.portfolio?.url,
            quote: "Visible owner text does not match the candidate label.",
            artifactPath: `${input.evidencePacket.run.runDir}/evidence_packet.json`,
          },
        ],
      },
    ],
    nextSteps: [
      "Verify portfolio ownership directly with the candidate.",
      "Request candidate confirmation for any external portfolio links.",
    ],
    citations: [
      {
        source: "portfolio",
        url: input.evidencePacket.sources.portfolio?.url,
        quote: "Visible owner text does not match the candidate label.",
        artifactPath: `${input.evidencePacket.run.runDir}/evidence_packet.json`,
      },
    ],
    flags: input.evidencePacket.flags,
    stageStatus: input.evidencePacket.stageStatus,
    provider: "bedrock-converse",
    modelId: "amazon.nova-lite-v1:0",
    parseOk: true,
    validationOk: true,
    usedFallback: false,
    degraded: false,
    metrics: {
      latencyMs: 1200,
      attempts: 1,
      inputTokensEstimated: 900,
      outputTokensEstimated: 300,
      timestampISO: new Date().toISOString(),
      requestId: "optional-request-id",
    },
  });

  const system = [
    "You are a recruiter-side social screening reasoner for AI Hire AI.",
    "Use only the provided evidence packet and evidence summary.",
    "Never invent facts.",
    "If evidence is partial or missing, say so explicitly and lower confidence.",
    "Do not mention Nova Act internal reasoning or hidden chain-of-thought.",
    "Always include citations referencing the provided packet evidence.",
    "Return strict JSON only. No markdown. No prose outside JSON.",
  ].join(" ");

  const prompt = [
    roleContext ? `Recruiter context:\n${roleContext}` : null,
    "Instructions:",
    "- Use only provided evidence.",
    "- If a stageStatus is partial, mention that it is partial in findings/concerns/next steps when relevant.",
    "- Do not reuse example names, organizations, or mismatch text from the schema hint unless the same text appears in the provided evidence packet.",
    "- A critical identity mismatch should produce at least a medium risk, typically high, and recommendation REVIEW or REJECT based on evidence strength.",
    "- Keep verifiedFindings factual and concise.",
    "- Keep concerns focused on actual risks from the evidence packet.",
    "- nextSteps should tell the recruiter exactly what to verify next.",
    "",
    "Evidence Packet Summary:",
    input.evidencePacket.bedrockInput.socialEvidencePacket,
    "",
    "Evidence Packet JSON:",
    compactJson({
      candidate: input.evidencePacket.candidate,
      run: input.evidencePacket.run,
      stageStatus: input.evidencePacket.stageStatus,
      sources: input.evidencePacket.sources,
      flags: input.evidencePacket.flags,
      claims: input.evidencePacket.claims,
      highlights: input.evidencePacket.highlights,
      trace: {
        mode: input.evidencePacket.trace.mode,
        summary: input.evidencePacket.trace.summary,
        steps: input.evidencePacket.trace.steps.slice(0, 20),
      },
    }),
    "",
    "Output schema hint:",
    schemaHint,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    feature: "social_evidence_reasoner",
    system,
    prompt,
    schemaHint,
  };
}
