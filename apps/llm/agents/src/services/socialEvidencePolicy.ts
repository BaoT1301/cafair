import type { EvidencePacket } from "../schema/evidencePacketSchema.js";
import type {
  RecruiterSocialScreenFromEvidencePacket,
  SocialEvidenceCitation,
} from "../schema/socialEvidenceReasonerSchema.js";

function normalizeText(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function isSuspiciousCandidateId(value?: string): boolean {
  const normalized = normalizeText(value);
  return !normalized || normalized === "optional-string" || normalized.includes("optional");
}

function rewriteCitationArtifactPath(
  citation: SocialEvidenceCitation,
  packet: EvidencePacket,
): SocialEvidenceCitation {
  const artifactPath = citation.artifactPath;
  const quote = citation.quote?.trim();
  if (!artifactPath || !quote) return citation;
  if (!artifactPath.endsWith("capture.json")) return citation;

  const matchingClaim = packet.claims.find((claim) =>
    claim.evidence.some(
      (evidence) =>
        (evidence.quote?.trim() ?? "") === quote &&
        evidence.source === citation.source,
    ),
  );

  if (!matchingClaim) return citation;

  return {
    ...citation,
    artifactPath: `${packet.run.runDir}/evidence_packet.json`,
  };
}

function rewriteCitations(
  citations: SocialEvidenceCitation[] | undefined,
  packet: EvidencePacket,
): SocialEvidenceCitation[] | undefined {
  if (!citations?.length) return citations;
  return citations.map((citation) => rewriteCitationArtifactPath(citation, packet));
}

function hasCriticalMismatchSignal(packet: EvidencePacket): boolean {
  if (packet.flags.includes("IDENTITY_MISMATCH_WEBSITE_OWNER")) return true;

  return packet.claims.some((claim) => {
    if (claim.severity !== "critical") return false;
    const haystack = `${claim.title} ${claim.statement}`.toLowerCase();
    return haystack.includes("mismatch") || haystack.includes("different owner");
  });
}

function ensureStep(nextSteps: string[], step: string): string[] {
  return nextSteps.some((existing) => existing.toLowerCase() === step.toLowerCase())
    ? nextSteps
    : [...nextSteps, step];
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function lacksSufficientCoverage(packet: EvidencePacket): boolean {
  const statuses = Object.values(packet.stageStatus);
  const noHealthyStages = statuses.every((status) => status !== "ok");
  const onlyWeakClaims = packet.claims.every(
    (claim) => claim.severity === "info" || claim.severity === "verified",
  );
  return noHealthyStages && onlyWeakClaims;
}

export function sanitizeCandidateId(value?: string): string | undefined {
  return isSuspiciousCandidateId(value) ? undefined : value?.trim() || undefined;
}

export function applySocialEvidencePolicy(
  result: RecruiterSocialScreenFromEvidencePacket,
  packet: EvidencePacket,
): RecruiterSocialScreenFromEvidencePacket {
  const normalized: RecruiterSocialScreenFromEvidencePacket = {
    ...result,
    candidateId: sanitizeCandidateId(result.candidateId),
    verifiedFindings: result.verifiedFindings.map((finding) => ({
      ...finding,
      citations: rewriteCitations(finding.citations, packet) ?? [],
    })),
    concerns: result.concerns.map((concern) => ({
      ...concern,
      citations: rewriteCitations(concern.citations, packet),
    })),
    citations: rewriteCitations(result.citations, packet) ?? [],
    flags: dedupeStrings([...result.flags, ...packet.flags]),
  };

  if (!hasCriticalMismatchSignal(packet)) {
    if (normalized.degraded && lacksSufficientCoverage(packet)) {
      const nextSteps = ensureStep(
        normalized.nextSteps,
        "Verify the candidate's public profiles manually before using this social screen result.",
      ).slice(0, 12);
      return {
        ...normalized,
        risk: normalized.risk === "high" ? "high" : "medium",
        recommendation: "REVIEW",
        nextSteps,
      };
    }
    return normalized;
  }

  const mismatchStep = "Confirm portfolio ownership before using portfolio signals.";
  const nextSteps = ensureStep(normalized.nextSteps, mismatchStep).slice(0, 12);

  return {
    ...normalized,
    risk: "high",
    recommendation: "REVIEW",
    nextSteps,
  };
}
