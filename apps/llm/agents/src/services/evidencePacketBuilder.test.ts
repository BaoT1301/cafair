import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildEvidencePacketFromRun,
  saveEvidencePacket,
  writeSocialEvidencePacket,
} from "./evidencePacketBuilder.js";

const tempDirs: string[] = [];

function fixturePath(name: string): string {
  return path.resolve(
    __dirname,
    "../../tests/fixtures/social_runs",
    name,
  );
}

function copyFixture(name: string): string {
  const source = fixturePath(name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `evidence-packet-${name}-`));
  tempDirs.push(target);
  fs.cpSync(source, target, { recursive: true });
  return target;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("evidence packet builder", () => {
  it("builds packet even when linkedin/github fields are null", () => {
    const runDir = copyFixture("null-structured");
    fs.writeFileSync(path.join(runDir, "nova_trace.txt"), "", "utf-8");
    const packet = buildEvidencePacketFromRun({ runDir });

    expect(packet.version).toBe("1.0");
    expect(packet.stageStatus.linkedin).toBe("partial");
    expect(packet.stageStatus.github).toBe("partial");
    expect(packet.claims.length).toBeGreaterThan(0);
    expect(packet.flags).toContain("IDENTITY_MISMATCH_WEBSITE_OWNER");
    expect(packet.trace.mode).toBe("synthetic");
    expect(packet.trace.steps.length).toBeGreaterThanOrEqual(8);
  });

  it("extracts think and action metrics from the trace", () => {
    const runDir = copyFixture("rich-return");
    const packet = buildEvidencePacketFromRun({ runDir });

    expect(packet.metrics.thinkCount).toBeGreaterThan(0);
    expect(packet.metrics.actionCounts.return).toBeGreaterThan(0);
    expect(packet.metrics.actionCounts.agentClick).toBeGreaterThan(0);
    expect(packet.metrics.actionCounts.agentType).toBeGreaterThan(0);
    expect(packet.metrics.actionCounts.agentScroll).toBeGreaterThan(0);
    expect(packet.metrics.actionCounts.goToUrl).toBeGreaterThan(0);
    expect(packet.trace.mode).toBe("real");
  });

  it("parses a direct sample trace with think and action lines", () => {
    const runDir = copyFixture("null-structured");
    const tracePath = path.join(runDir, "nova_trace.txt");
    fs.writeFileSync(
      tracePath,
      [
        "===== STAGE: linkedin =====",
        'abcd> think("I see the visible headline is Senior Data Scientist and the contact email is <EMAIL>.");',
        'abcd> agentClick("<box>10,10,100,40</box>");',
        'abcd> agentType("<EMAIL>");',
        'abcd> agentScroll("down", "<box>0,0,800,1200</box>");',
        'abcd> goToUrl("https://www.linkedin.com/in/example");',
        'abcd> return("BEGIN_CAPTURE_JSON { \\"stageStatus\\": { \\"linkedin\\": \\"partial\\" } } END_CAPTURE_JSON");',
        "",
      ].join("\n"),
      "utf-8",
    );

    const packet = buildEvidencePacketFromRun({ runDir });

    expect(packet.metrics.thinkCount).toBeGreaterThan(0);
    expect(packet.metrics.actionCounts.return).toBe(1);
    expect(packet.metrics.actionCounts.agentClick).toBe(1);
    expect(packet.metrics.actionCounts.agentType).toBe(1);
    expect(packet.metrics.actionCounts.agentScroll).toBe(1);
    expect(packet.metrics.actionCounts.goToUrl).toBe(1);
    expect(packet.trace.mode).toBe("real");
  });

  it("detects portfolio identity mismatch and emits a critical claim", () => {
    const runDir = copyFixture("rich-return");
    const packet = buildEvidencePacketFromRun({ runDir });

    expect(packet.flags).toContain("IDENTITY_MISMATCH_WEBSITE_OWNER");
    expect(
      packet.claims.some(
        (claim) =>
          claim.severity === "critical" &&
          /portfolio appears owned by/i.test(claim.statement),
      ),
    ).toBe(true);
  });

  it("produces evidence_packet.json and evidence_packet.md", () => {
    const runDir = copyFixture("rich-return");
    const { packet, jsonPath, mdPath } = saveEvidencePacket({ runDir });

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);
    expect(packet.claims.length).toBeGreaterThan(0);
  });

  it("writeSocialEvidencePacket keeps compatibility wrapper output", () => {
    const runDir = copyFixture("rich-return");
    const { packet, evidencePacketPath, evidencePacketMarkdownPath } =
      writeSocialEvidencePacket({ runDir });

    expect(fs.existsSync(evidencePacketPath)).toBe(true);
    expect(fs.existsSync(evidencePacketMarkdownPath)).toBe(true);
    expect(packet.bedrockInput.socialEvidencePacket).toContain("Candidate Label:");
  });
});
