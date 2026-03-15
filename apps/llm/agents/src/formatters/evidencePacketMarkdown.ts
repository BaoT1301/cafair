import type { EvidencePacket } from "../schema/evidencePacketSchema.js";

function sectionList(items: string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- none"];
}

export function renderEvidencePacketMarkdown(packet: EvidencePacket): string {
  const lines: string[] = [
    "# Social Evidence Packet",
    "",
    `Candidate: ${packet.candidate.label}`,
    `Created: ${packet.createdAtISO}`,
    `Run Dir: ${packet.run.runDir}`,
    "",
    "## Stage Status",
    "| Stage | Status |",
    "| --- | --- |",
    `| LinkedIn | ${packet.stageStatus.linkedin} |`,
    `| GitHub | ${packet.stageStatus.github} |`,
    `| Portfolio | ${packet.stageStatus.portfolio} |`,
    `| Web | ${packet.stageStatus.web} |`,
    "",
    "## Flags",
    ...sectionList(packet.flags),
    "",
    "## Highlights",
    "### Positives",
    ...sectionList(packet.highlights.positives),
    "### Concerns",
    ...sectionList(packet.highlights.concerns),
    "### Missing",
    ...sectionList(packet.highlights.missing),
    "",
    "## Claims",
    ...(
      packet.claims.length
        ? packet.claims.map((claim) => {
            const evidence = claim.evidence
              .map((item) => item.quote ?? item.url ?? item.artifactPath ?? item.source)
              .filter(Boolean)
              .slice(0, 2)
              .join(" | ");
            return `- [${claim.severity}] ${claim.title}: ${claim.statement}${evidence ? ` (${evidence})` : ""}`;
          })
        : ["- none"]
    ),
    "",
    "## Evidence Snippets",
  ];

  for (const claim of packet.claims) {
    lines.push(`### ${claim.title}`);
    for (const evidence of claim.evidence) {
      lines.push(
        `- ${evidence.source}: ${evidence.quote ?? evidence.url ?? evidence.artifactPath ?? "no snippet"}`,
      );
    }
  }

  lines.push(
    "",
    "## Trace",
    `Mode: ${packet.trace.mode}`,
    packet.trace.summary,
    ...packet.trace.steps.map(
      (step) => `- [${step.stage}] ${step.action}: ${step.observed}`,
    ),
    "",
    "## Artifact Links",
    `- capture.json: ${packet.run.runDir}/capture.json`,
    `- nova_return_block.txt: ${packet.run.runDir}/nova_return_block.txt`,
    `- evidence_packet.json: ${packet.run.runDir}/evidence_packet.json`,
    `- evidence_packet.md: ${packet.run.runDir}/evidence_packet.md`,
  );

  if (packet.run.replayHtml) {
    lines.push(`- replay.html: ${packet.run.replayHtml}`);
  }

  return `${lines.join("\n")}\n`;
}

