import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { runBedrockSocialEvidenceReasoner } from "../agents/socialEvidenceReasoner.js";
import { parseSocialEvidenceReasonerText } from "../parsers/socialEvidenceReasonerParser.js";
import {
  recruiterSocialScreenFromEvidencePacketSchema,
} from "../schema/socialEvidenceReasonerSchema.js";
import { buildEvidencePacketFromRun, saveEvidencePacket } from "./evidencePacketBuilder.js";

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
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `social-reasoner-${name}-`));
  tempDirs.push(target);
  fs.cpSync(source, target, { recursive: true });
  return target;
}

afterEach(() => {
  delete process.env.USE_REAL_BEDROCK;
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("social evidence reasoner", () => {
  it("fallback mode works when Bedrock is disabled", async () => {
    process.env.USE_REAL_BEDROCK = "false";
    const runDir = copyFixture("rich-return");
    const packet = buildEvidencePacketFromRun({ runDir });

    const result = await runBedrockSocialEvidenceReasoner({
      evidencePacket: packet,
      candidateId: "cand_123",
    });

    expect(result.risk).toBe("high");
    expect(result.recommendation).toBe("REVIEW");
    expect(result.flags).toContain("IDENTITY_MISMATCH_WEBSITE_OWNER");
    expect(
      result.concerns.some((concern) =>
        /portfolio appears owned by/i.test(concern.text),
      ),
    ).toBe(true);
    expect(
      result.citations.some((citation) =>
        /does not match candidate label/i.test(citation.quote ?? ""),
      ),
    ).toBe(true);
    expect(
      result.concerns.some((concern) =>
        concern.citations?.some((citation) =>
          /evidence_packet\.json$/.test(citation.artifactPath ?? ""),
        ),
      ),
    ).toBe(true);
    expect(
      result.nextSteps.some((step) =>
        /confirm portfolio ownership before using portfolio signals/i.test(step),
      ),
    ).toBe(true);
    expect(result.usedFallback).toBe(true);
  });

  it("partial stage status results in verify-style next steps", async () => {
    process.env.USE_REAL_BEDROCK = "false";
    const runDir = copyFixture("rich-return");
    const packet = buildEvidencePacketFromRun({ runDir });

    const result = await runBedrockSocialEvidenceReasoner({
      evidencePacket: packet,
    });

    expect(result.stageStatus.linkedin).toBe("partial");
    expect(
      result.nextSteps.some((step) => /verify/i.test(step)),
    ).toBe(true);
  });

  it("degraded packets without enough coverage do not default to proceed", async () => {
    process.env.USE_REAL_BEDROCK = "false";
    const runDir = copyFixture("rich-return");
    const packet = buildEvidencePacketFromRun({ runDir });
    packet.flags = [];
    packet.claims = packet.claims
      .filter((claim) => claim.severity === "info")
      .map((claim) => ({ ...claim, severity: "info" as const }));
    packet.stageStatus = {
      linkedin: "skipped",
      github: "skipped",
      portfolio: "partial",
      web: "skipped",
    };
    packet.trace.mode = "synthetic";

    const result = await runBedrockSocialEvidenceReasoner({
      evidencePacket: packet,
    });

    expect(result.degraded).toBe(true);
    expect(result.risk).toBe("medium");
    expect(result.recommendation).toBe("REVIEW");
    expect(result.nextSteps.some((step) => /verify/i.test(step))).toBe(true);
  });

  it("candidateId is sanitized when omitted or placeholder-like", async () => {
    process.env.USE_REAL_BEDROCK = "false";
    const runDir = copyFixture("rich-return");
    const packet = buildEvidencePacketFromRun({ runDir });

    const result = await runBedrockSocialEvidenceReasoner({
      evidencePacket: packet,
      candidateId: "optional-string",
    });

    expect(result.candidateId).toBeUndefined();
  });

  it("parser can extract JSON from fenced and raw text", () => {
    const fenced = [
      "```json",
      JSON.stringify(
        {
          candidateLabel: "Nguyen Phan Nguyen",
          socialScore: 40,
          risk: "high",
          recommendation: "REVIEW",
          verifiedFindings: [],
          concerns: [],
          nextSteps: ["Verify portfolio ownership"],
          citations: [],
          flags: ["IDENTITY_MISMATCH_WEBSITE_OWNER"],
          stageStatus: {
            linkedin: "partial",
            github: "partial",
            portfolio: "partial",
            web: "skipped",
          },
          provider: "bedrock-converse",
          modelId: "amazon.nova-lite-v1:0",
          parseOk: true,
          validationOk: true,
          usedFallback: false,
          degraded: false,
        },
        null,
        2,
      ),
      "```",
    ].join("\n");

    const raw = fenced.replace(/```json\n|\n```/g, "");

    expect(parseSocialEvidenceReasonerText(fenced).parseOk).toBe(true);
    expect(parseSocialEvidenceReasonerText(raw).parseOk).toBe(true);
  });

  it("schema validation catches missing required fields", () => {
    expect(() =>
      recruiterSocialScreenFromEvidencePacketSchema.parse({
        candidateLabel: "Nguyen Phan Nguyen",
      }),
    ).toThrow();
  });

  it("cli --json-only prints exactly one JSON object to stdout", async () => {
    process.env.USE_REAL_BEDROCK = "false";
    const runDir = copyFixture("rich-return");
    saveEvidencePacket({ runDir });

    const stdout = execFileSync(
      path.resolve(process.cwd(), "node_modules/.bin/tsx"),
      [
        "apps/llm/agents/scripts/run-social-evidence-reasoner-local.ts",
        "--run-dir",
        runDir,
        "--json-only",
      ],
      {
        cwd: path.resolve(process.cwd()),
        env: {
          ...process.env,
          USE_REAL_BEDROCK: "false",
        },
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const parsed = JSON.parse(stdout);
    expect(parsed.risk).toBe("high");
    expect(parsed.recommendation).toBe("REVIEW");
    expect(parsed.flags).toContain("IDENTITY_MISMATCH_WEBSITE_OWNER");
  });
});
