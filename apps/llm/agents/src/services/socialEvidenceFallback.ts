import type { EvidencePacket, EvidencePacketClaim } from "../schema/evidencePacketSchema.js";
import type {
  RecruiterSocialScreenFromEvidencePacket,
  SocialEvidenceCitation,
  SocialEvidenceConcern,
  SocialEvidenceFinding,
} from "../schema/socialEvidenceReasonerSchema.js";

function normalizeCitation(
  evidence: EvidencePacketClaim["evidence"][number],
): SocialEvidenceCitation {
  return {
    source: evidence.source,
    url: evidence.url,
    quote: evidence.quote,
    artifactPath: evidence.artifactPath,
  };
}

function dedupeCitations(
  citations: SocialEvidenceCitation[],
): SocialEvidenceCitation[] {
  const seen = new Set<string>();
  const output: SocialEvidenceCitation[] = [];
  for (const citation of citations) {
    const key = JSON.stringify(citation);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(citation);
  }
  return output.slice(0, 24);
}

function deriveRisk(packet: EvidencePacket): "low" | "medium" | "high" {
  const criticalCount = packet.claims.filter((claim) => claim.severity === "critical").length;
  const warningCount = packet.claims.filter((claim) => claim.severity === "warning").length;
  const partialStages = Object.values(packet.stageStatus).filter(
    (status) => status === "partial" || status === "blocked",
  ).length;

  if (criticalCount > 0) return "high";
  if (warningCount >= 2 || partialStages >= 2) return "medium";
  return "low";
}

function deriveRecommendation(
  risk: "low" | "medium" | "high",
  packet: EvidencePacket,
): "PROCEED" | "REVIEW" | "REJECT" {
  const criticalCount = packet.claims.filter((claim) => claim.severity === "critical").length;
  if (risk === "high" && criticalCount > 1) return "REJECT";
  if (risk === "high" || risk === "medium") return "REVIEW";
  return "PROCEED";
}

function deriveScore(
  risk: "low" | "medium" | "high",
  packet: EvidencePacket,
): number {
  let score = 78;
  score -= packet.claims.filter((claim) => claim.severity === "critical").length * 28;
  score -= packet.claims.filter((claim) => claim.severity === "warning").length * 12;
  score -= Object.values(packet.stageStatus).filter((status) => status === "partial").length * 6;
  if (risk === "low") score += 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildVerifiedFindings(packet: EvidencePacket): SocialEvidenceFinding[] {
  const findings = packet.claims
    .filter((claim) => claim.severity === "info" || claim.severity === "verified")
    .slice(0, 6)
    .map<SocialEvidenceFinding>((claim) => ({
      text: claim.statement,
      severity: claim.severity === "verified" ? "info" : claim.severity,
      citations: claim.evidence.map(normalizeCitation).slice(0, 4),
    }));

  if (findings.length > 0) return findings;

  return [
    {
      text: `Evidence packet created with ${packet.trace.mode} trace support.`,
      severity: "info",
      citations: [
        {
          source: "system",
          quote: packet.trace.summary,
          artifactPath: `${packet.run.runDir}/evidence_packet.json`,
        },
      ],
    },
  ];
}

function buildConcerns(packet: EvidencePacket): SocialEvidenceConcern[] {
  return packet.claims
    .filter((claim) => claim.severity === "warning" || claim.severity === "critical")
    .slice(0, 8)
    .map<SocialEvidenceConcern>((claim) => ({
      text: claim.statement,
      severity: claim.severity === "critical" ? "critical" : "warning",
      citations: claim.evidence.map(normalizeCitation).slice(0, 4),
    }));
}

function buildNextSteps(packet: EvidencePacket): string[] {
  const nextSteps = new Set<string>();
  if (packet.flags.includes("IDENTITY_MISMATCH_WEBSITE_OWNER")) {
    nextSteps.add("Verify portfolio ownership with the candidate before relying on portfolio evidence.");
    nextSteps.add("Request candidate confirmation for any portfolio or personal website links.");
  }
  if (packet.stageStatus.linkedin === "partial" || packet.stageStatus.linkedin === "blocked") {
    nextSteps.add("Verify LinkedIn profile details manually because LinkedIn capture is partial.");
  }
  if (packet.stageStatus.github === "partial" || packet.stageStatus.github === "blocked") {
    nextSteps.add("Verify GitHub profile and repository evidence manually because GitHub capture is partial.");
  }
  if (packet.stageStatus.portfolio === "partial" || packet.stageStatus.portfolio === "blocked") {
    nextSteps.add("Review the portfolio site manually and confirm that it belongs to the candidate.");
  }
  if (!packet.claims.length) {
    nextSteps.add("Collect additional social evidence before making a recruiter decision.");
  }
  if (!nextSteps.size) {
    nextSteps.add("Proceed with normal recruiter review using the captured social evidence.");
  }
  return [...nextSteps].slice(0, 12);
}

export function buildSocialEvidenceFallbackReport(
  packet: EvidencePacket,
  options?: {
    candidateId?: string;
    provider?: string;
    modelId?: string;
    parseOk?: boolean;
    validationOk?: boolean;
    usedFallback?: boolean;
    degraded?: boolean;
    metrics?: RecruiterSocialScreenFromEvidencePacket["metrics"];
  },
): RecruiterSocialScreenFromEvidencePacket {
  const risk = deriveRisk(packet);
  const recommendation = deriveRecommendation(risk, packet);
  const verifiedFindings = buildVerifiedFindings(packet);
  const concerns = buildConcerns(packet);
  const citations = dedupeCitations([
    ...verifiedFindings.flatMap((finding) => finding.citations),
    ...concerns.flatMap((concern) => concern.citations ?? []),
  ]);

  return {
    candidateId: options?.candidateId,
    candidateLabel: packet.candidate.label,
    socialScore: deriveScore(risk, packet),
    risk,
    recommendation,
    verifiedFindings,
    concerns,
    nextSteps: buildNextSteps(packet),
    citations,
    flags: packet.flags,
    stageStatus: packet.stageStatus,
    provider: options?.provider ?? "deterministic-fallback",
    modelId: options?.modelId ?? "deterministic-fallback",
    parseOk: options?.parseOk ?? false,
    validationOk: options?.validationOk ?? true,
    usedFallback: options?.usedFallback ?? true,
    degraded: options?.degraded ?? true,
    metrics: options?.metrics,
  };
}
