import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderEvidencePacketMarkdown } from "../formatters/evidencePacketMarkdown.js";
import { parseNovaReturnBlock } from "../parsers/novaReturnBlockParser.js";
import { parseNovaTrace } from "../parsers/novaTraceParser.js";
import {
  evidencePacketSchema,
  type EvidencePacket,
  type EvidencePacketClaim,
  type EvidencePacketStageStatus,
} from "../schema/evidencePacketSchema.js";

type LooseRecord = Record<string, unknown>;

type BuildOptions = {
  runDir: string;
};

type RunArtifacts = {
  runDir: string;
  captureJsonPath: string;
  tracePath: string;
  returnBlockPath: string;
  replayHtmlPath?: string;
};

type CaptureShape = {
  inputs?: LooseRecord;
  outputs?: LooseRecord;
  artifacts?: LooseRecord;
  nova?: LooseRecord;
};

const DEBUG = process.env.DEBUG === "1";

function debugLog(message: string, payload?: unknown): void {
  if (!DEBUG) return;
  const suffix = payload === undefined ? "" : ` ${JSON.stringify(payload)}`;
  process.stderr.write(`[evidence-packet] ${message}${suffix}\n`);
}

function readJsonFile(filePath: string): LooseRecord {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as LooseRecord;
}

function readTextFileIfExists(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

function safeObject(value: unknown): LooseRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : {};
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeText(text: string, limit = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

function hashId(parts: string[]): string {
  return crypto
    .createHash("sha1")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 12);
}

function extractRunArtifacts(runDir: string): RunArtifacts {
  const captureJsonPath = path.join(runDir, "capture.json");
  const traceTextPath = path.join(runDir, "nova_trace.txt");
  const traceJsonlPath = path.join(runDir, "nova_trace.jsonl");
  const returnBlockPath = path.join(runDir, "nova_return_block.txt");
  const replayHtmlPath = path.join(runDir, "replay.html");

  if (!fs.existsSync(captureJsonPath)) {
    throw new Error(`capture.json not found in run dir: ${runDir}`);
  }
  if (!fs.existsSync(traceTextPath) && !fs.existsSync(traceJsonlPath)) {
    throw new Error(`nova_trace.txt or nova_trace.jsonl not found in run dir: ${runDir}`);
  }
  if (!fs.existsSync(returnBlockPath)) {
    throw new Error(`nova_return_block.txt not found in run dir: ${runDir}`);
  }

  return {
    runDir,
    captureJsonPath,
    tracePath: fs.existsSync(traceTextPath) ? traceTextPath : traceJsonlPath,
    returnBlockPath,
    replayHtmlPath: fs.existsSync(replayHtmlPath) ? replayHtmlPath : undefined,
  };
}

function stageStatusValue(value: unknown): EvidencePacketStageStatus {
  const raw =
    typeof value === "string"
      ? value
      : typeof safeObject(value).status === "string"
        ? String(safeObject(value).status)
        : "";

  const lowered = raw.toLowerCase();
  if (lowered === "ok") return "ok";
  if (lowered === "partial") return "partial";
  if (lowered === "blocked" || lowered === "failed") return "blocked";
  return "skipped";
}

function extractStageStatus(
  capture: CaptureShape,
  returnPayload: LooseRecord | null,
): EvidencePacket["stageStatus"] {
  const captureStageStatus = safeObject(safeObject(capture.outputs).stageStatus);
  const returnStageStatus = safeObject(returnPayload?.stageStatus);
  return {
    linkedin: stageStatusValue(captureStageStatus.linkedin ?? returnStageStatus.linkedin),
    github: stageStatusValue(captureStageStatus.github ?? returnStageStatus.github),
    portfolio: stageStatusValue(captureStageStatus.portfolio ?? returnStageStatus.portfolio),
    web: stageStatusValue(
      captureStageStatus.web ?? returnStageStatus.web ?? safeObject(capture.outputs).web,
    ),
  };
}

function collectFlags(capture: CaptureShape, returnPayload: LooseRecord | null): string[] {
  const outputs = safeObject(capture.outputs);
  const portfolio = safeObject(outputs.portfolio);
  const flags = new Set<string>([
    ...safeArray<string>(outputs.flags),
    ...safeArray<string>(returnPayload?.flags),
  ]);
  if (portfolio.mismatchFlag === true) {
    flags.add("IDENTITY_MISMATCH_WEBSITE_OWNER");
  }
  return [...flags];
}

function extractCandidate(
  capture: CaptureShape,
  returnPayload: LooseRecord | null,
  runDir: string,
): EvidencePacket["candidate"] {
  const outputs = safeObject(capture.outputs);
  const portfolio = safeObject(outputs.portfolio);
  const inputs = safeObject(capture.inputs);
  const label =
    safeString(portfolio.candidateLabel) ??
    safeString(safeObject(returnPayload?.portfolio).candidateLabel) ??
    safeString(inputs.candidateName) ??
    path.basename(path.dirname(runDir));

  return {
    label,
    candidateId: safeString(inputs.candidateId),
  };
}

function extractSources(
  capture: CaptureShape,
  returnPayload: LooseRecord | null,
): EvidencePacket["sources"] {
  const outputs = safeObject(capture.outputs);
  const inputs = safeObject(capture.inputs);
  const linkedin = safeObject(outputs.linkedin);
  const github = safeObject(outputs.github);
  const portfolio = safeObject(outputs.portfolio);
  const web = safeObject(outputs.web);

  return {
    linkedin:
      safeString(linkedin.url) || safeString(inputs.linkedin)
        ? {
            url: safeString(linkedin.url) ?? safeString(inputs.linkedin),
            found: typeof linkedin.found === "boolean" ? Boolean(linkedin.found) : undefined,
          }
        : undefined,
    github:
      safeString(github.url) || safeString(inputs.github)
        ? {
            url: safeString(github.url) ?? safeString(inputs.github),
            found: typeof github.found === "boolean" ? Boolean(github.found) : undefined,
          }
        : undefined,
    portfolio:
      safeString(portfolio.url) || safeString(inputs.portfolio)
        ? {
            url: safeString(portfolio.url) ?? safeString(inputs.portfolio),
            found: typeof portfolio.found === "boolean" ? Boolean(portfolio.found) : undefined,
            ownerName:
              safeString(portfolio.ownerName) ??
              safeString(safeObject(returnPayload?.portfolio).ownerName),
          }
        : undefined,
    web:
      safeArray<string>(web.queries).length || safeArray<string>(inputs.webQueries).length
        ? {
            queries: safeArray<string>(web.queries).length
              ? safeArray<string>(web.queries)
              : safeArray<string>(inputs.webQueries),
          }
        : undefined,
  };
}

function collectStageEvidence(stagePayload: LooseRecord): string[] {
  return [
    ...safeArray<string>(stagePayload.evidence),
    ...safeArray<string>(stagePayload.missing),
    ...safeArray<string>(stagePayload.warnings),
  ]
    .map((item) => normalizeText(String(item)))
    .filter(Boolean);
}

function addClaim(
  claims: EvidencePacketClaim[],
  seen: Set<string>,
  claim: Omit<EvidencePacketClaim, "id">,
): void {
  if (claims.length >= 12) return;
  const statement = normalizeText(claim.statement);
  if (!statement) return;
  const key = `${claim.severity}:${statement.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  claims.push({
    ...claim,
    id: `claim_${hashId([key])}`,
    title: normalizeText(claim.title, 120),
    statement,
    rationale: claim.rationale ? normalizeText(claim.rationale) : undefined,
    evidence: claim.evidence
      .map((item) => ({
        ...item,
        quote: item.quote ? normalizeText(item.quote) : undefined,
      }))
      .slice(0, 8),
  });
}

function buildClaims(
  capture: CaptureShape,
  returnPayload: LooseRecord | null,
  artifacts: RunArtifacts,
  candidate: EvidencePacket["candidate"],
  sources: EvidencePacket["sources"],
  stageStatus: EvidencePacket["stageStatus"],
  flags: string[],
): EvidencePacketClaim[] {
  const claims: EvidencePacketClaim[] = [];
  const seen = new Set<string>();
  const outputs = safeObject(capture.outputs);
  const linkedin = safeObject(outputs.linkedin);
  const github = safeObject(outputs.github);
  const portfolio = safeObject(outputs.portfolio);
  const web = safeObject(outputs.web);

  if (
    flags.includes("IDENTITY_MISMATCH_WEBSITE_OWNER") ||
    portfolio.mismatchFlag === true ||
    safeObject(returnPayload?.portfolio).mismatchFlag === true
  ) {
    const ownerName =
      safeString(portfolio.ownerName) ??
      safeString(safeObject(returnPayload?.portfolio).ownerName) ??
      "unknown";
    const portfolioEvidence = collectStageEvidence(portfolio);
    const returnEvidence = collectStageEvidence(safeObject(returnPayload?.portfolio));
    const quote =
      portfolioEvidence.find((item) => /does not match|mismatch|different/i.test(item)) ??
      returnEvidence.find((item) => /does not match|mismatch|different/i.test(item)) ??
      portfolioEvidence.find((item) => /owner name/i.test(item)) ??
      returnEvidence.find((item) => /owner name/i.test(item)) ??
      portfolioEvidence[0] ??
      returnEvidence[0] ??
      `Visible portfolio owner name appears to be '${ownerName}', which does not match candidate label '${candidate.label}'.`;
    addClaim(claims, seen, {
      severity: "critical",
      title: "Portfolio owner mismatch",
      statement: `Portfolio appears owned by ${ownerName}, not ${candidate.label}.`,
      rationale: "Recruiters should confirm the portfolio actually belongs to the candidate before trusting portfolio evidence.",
      evidence: [
        {
          source: "portfolio",
          quote,
          url: sources.portfolio?.url,
          artifactPath: artifacts.captureJsonPath,
        },
      ],
    });
  }

  for (const [stageName, status] of Object.entries(stageStatus) as Array<
    [keyof EvidencePacket["stageStatus"], EvidencePacketStageStatus]
  >) {
    if (stageName === "web" && status === "skipped") continue;
    if (status === "ok" || status === "skipped") continue;
    const stagePayload = safeObject(outputs[stageName]);
    const quote =
      collectStageEvidence(stagePayload)[0] ??
      `${stageName} stage completed with status ${status}.`;
    addClaim(claims, seen, {
      severity: "warning",
      title: `${stageName.charAt(0).toUpperCase() + stageName.slice(1)} stage incomplete`,
      statement: `${stageName.charAt(0).toUpperCase() + stageName.slice(1)} capture ${status}; structured evidence is limited.`,
      rationale: "Downstream recruiter review should treat this stage as incomplete.",
      evidence: [
        {
          source: stageName === "web" ? "system" : (stageName as "linkedin" | "github" | "portfolio"),
          quote,
          url:
            stageName === "linkedin"
              ? sources.linkedin?.url
              : stageName === "github"
                ? sources.github?.url
                : stageName === "portfolio"
                  ? sources.portfolio?.url
                  : undefined,
          artifactPath: artifacts.replayHtmlPath,
        },
      ],
    });
  }

  const explicitSummaryMissingPatterns = [
    ...collectStageEvidence(linkedin),
    ...collectStageEvidence(github),
    ...collectStageEvidence(portfolio),
  ].filter((item) => /explicit summary payload/i.test(item));

  if (explicitSummaryMissingPatterns.length) {
    addClaim(claims, seen, {
      severity: "info",
      title: "Structured summary missing",
      statement: "Nova Act did not emit a complete structured stage summary for part of the run.",
      rationale: "Bedrock should rely more heavily on normalized outputs and return-block parsing for this run.",
      evidence: explicitSummaryMissingPatterns.slice(0, 2).map((quote) => ({
        source: "system",
        quote,
        artifactPath: artifacts.returnBlockPath,
      })),
    });
  }

  const candidateEvidence: Array<{
    source: "linkedin" | "github" | "portfolio" | "web";
    payload: LooseRecord;
    url?: string;
  }> = [
    { source: "linkedin", payload: linkedin, url: sources.linkedin?.url },
    { source: "github", payload: github, url: sources.github?.url },
    { source: "portfolio", payload: portfolio, url: sources.portfolio?.url },
    { source: "web", payload: web },
  ];

  for (const item of candidateEvidence) {
    for (const quote of collectStageEvidence(item.payload).slice(0, 2)) {
      addClaim(claims, seen, {
        severity: /mismatch|failed|blocked|warning/i.test(quote) ? "warning" : "info",
        title: `${item.source.charAt(0).toUpperCase() + item.source.slice(1)} evidence`,
        statement: quote,
        evidence: [
          {
            source: item.source === "web" ? "web" : item.source,
            quote,
            url: item.url,
            artifactPath: artifacts.captureJsonPath,
          },
        ],
      });
    }
  }

  const severityOrder: Record<EvidencePacketClaim["severity"], number> = {
    critical: 0,
    warning: 1,
    verified: 2,
    info: 3,
  };

  return claims
    .sort(
      (left, right) =>
        severityOrder[left.severity] - severityOrder[right.severity] ||
        left.title.localeCompare(right.title),
    )
    .slice(0, 12);
}

function parseRealTraceSteps(traceText: string): EvidencePacket["trace"]["steps"] {
  const steps: EvidencePacket["trace"]["steps"] = [];
  let currentStage = "unknown";
  for (const rawLine of traceText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const stageMatch = line.match(/^===== STAGE:\s*([a-z0-9_-]+)\s*=====$/i);
    if (stageMatch) {
      currentStage = stageMatch[1].toLowerCase();
      continue;
    }
    let action: string | undefined;
    let observed: string | undefined;
    const thinkMatch = line.match(/think\("([\s\S]*?)"\);?/);
    if (thinkMatch) {
      action = "Think";
      observed = thinkMatch[1]?.replace(/\\"/g, "\"").replace(/\\n/g, " ");
    }
    const callMatch = line.match(/(agentClick|agentType|agentScroll|goToUrl)\(([\s\S]*?)\);?/);
    if (!action && callMatch) {
      action = callMatch[1];
      observed = callMatch[2];
    }
    const returnMatch = line.match(/return\("([\s\S]*?)"\);?/);
    if (!action && returnMatch) {
      action = "return";
      observed = returnMatch[1]?.replace(/\\"/g, "\"").replace(/\\n/g, " ");
    }
    if (!action || !observed) continue;
    steps.push({
      stage: currentStage,
      action,
      observed: normalizeText(observed),
    });
    if (steps.length >= 60) break;
  }
  return steps;
}

function buildSyntheticTrace(
  capture: CaptureShape,
  candidate: EvidencePacket["candidate"],
  sources: EvidencePacket["sources"],
  stageStatus: EvidencePacket["stageStatus"],
  flags: string[],
): EvidencePacket["trace"] {
  const outputs = safeObject(capture.outputs);
  const steps: EvidencePacket["trace"]["steps"] = [];
  const stageOrder: Array<keyof EvidencePacket["stageStatus"]> = [
    "linkedin",
    "github",
    "portfolio",
    "web",
  ];

  for (const stageName of stageOrder) {
    const status = stageStatus[stageName];
    const payload = safeObject(outputs[stageName]);
    const stageUrl =
      stageName === "linkedin"
        ? sources.linkedin?.url
        : stageName === "github"
          ? sources.github?.url
          : stageName === "portfolio"
            ? sources.portfolio?.url
            : undefined;
    const stageQueries = stageName === "web" ? sources.web?.queries : undefined;
    if (stageName === "web" && status === "skipped" && !stageQueries?.length) {
      continue;
    }

    if (stageUrl) {
      steps.push({
        stage: stageName,
        action: "Opened URL",
        observed: `${stageName} source URL: ${stageUrl}`,
      });
    } else if (stageName === "web" && stageQueries?.length) {
      steps.push({
        stage: "web",
        action: "Prepared web queries",
        observed: `Web queries recorded: ${stageQueries.join("; ")}`,
      });
    }

    steps.push({
      stage: stageName,
      action: "Reviewed stage status",
      observed: `${stageName} stage status: ${status}`,
    });

    for (const quote of collectStageEvidence(payload).slice(0, 3)) {
      steps.push({
        stage: stageName,
        action: "Captured evidence",
        observed: quote,
      });
    }

    if (!collectStageEvidence(payload).length) {
      steps.push({
        stage: stageName,
        action: "Recorded limitation",
        observed: "No structured return captured; stage partial.",
      });
    }
  }

  if (flags.includes("IDENTITY_MISMATCH_WEBSITE_OWNER")) {
    const portfolio = safeObject(outputs.portfolio);
    steps.push({
      stage: "portfolio",
      action: "Compared identity",
      observed: `Mismatch vs candidate label ${candidate.label}; portfolio owner appears to be ${safeString(portfolio.ownerName) ?? "unknown"}.`,
    });
  }

  return {
    mode: "synthetic",
    summary:
      "Nova Act trace was missing or redacted; generated synthetic trace from return block, parsed outputs, and flags.",
    steps: steps.slice(0, 80),
  };
}

function buildTrace(
  capture: CaptureShape,
  candidate: EvidencePacket["candidate"],
  sources: EvidencePacket["sources"],
  stageStatus: EvidencePacket["stageStatus"],
  flags: string[],
  traceText: string,
): EvidencePacket["trace"] {
  const parsedTrace = parseNovaTrace(traceText);
  const hasRealTrace =
    parsedTrace.thinkCount > 0 ||
    parsedTrace.returnCount > 0 ||
    Object.values(parsedTrace.actionCounts).some((count) => count > 0);

  if (!hasRealTrace) {
    return buildSyntheticTrace(capture, candidate, sources, stageStatus, flags);
  }

  const steps = parseRealTraceSteps(traceText);
  if (!steps.length) {
    return buildSyntheticTrace(capture, candidate, sources, stageStatus, flags);
  }

  return {
    mode: "real",
    summary: "Used saved Nova Act transcript extracted from run artifacts.",
    steps,
  };
}

function buildHighlights(
  claims: EvidencePacketClaim[],
  capture: CaptureShape,
  stageStatus: EvidencePacket["stageStatus"],
): EvidencePacket["highlights"] {
  const outputs = safeObject(capture.outputs);
  const positives = claims
    .filter((claim) => claim.severity === "verified" || claim.severity === "info")
    .map((claim) => claim.statement)
    .slice(0, 8);
  const concerns = claims
    .filter((claim) => claim.severity === "warning" || claim.severity === "critical")
    .map((claim) => claim.statement)
    .slice(0, 8);
  const missing = [
    ...collectStageEvidence(safeObject(outputs.linkedin)).filter((item) => /missing|partial|payload/i.test(item)),
    ...collectStageEvidence(safeObject(outputs.github)).filter((item) => /missing|partial|payload/i.test(item)),
    ...collectStageEvidence(safeObject(outputs.portfolio)).filter((item) => /missing|partial|payload|failed/i.test(item)),
  ];
  for (const [stageName, status] of Object.entries(stageStatus)) {
    if (status !== "ok" && status !== "skipped") {
      missing.push(`${stageName} stage status: ${status}.`);
    }
  }
  return {
    positives: [...new Set(positives.map((item) => normalizeText(item)))].slice(0, 12),
    concerns: [...new Set(concerns.map((item) => normalizeText(item)))].slice(0, 12),
    missing: [...new Set(missing.map((item) => normalizeText(item)))].slice(0, 12),
  };
}

function buildBedrockInput(
  candidate: EvidencePacket["candidate"],
  stageStatus: EvidencePacket["stageStatus"],
  flags: string[],
  claims: EvidencePacketClaim[],
): string {
  const lines = [
    `Candidate Label: ${candidate.label}`,
    `Stage Status: linkedin=${stageStatus.linkedin}, github=${stageStatus.github}, portfolio=${stageStatus.portfolio}, web=${stageStatus.web}`,
    `Flags: ${flags.length ? flags.join(", ") : "none"}`,
    "Top Claims:",
    ...claims.slice(0, 8).map((claim) => {
      const evidenceQuotes = claim.evidence
        .map((item) => item.quote ?? item.url ?? item.artifactPath ?? item.source)
        .filter(Boolean)
        .slice(0, 2)
        .join(" | ");
      return `- [${claim.severity}] ${claim.title}: ${claim.statement}${evidenceQuotes ? ` Evidence: ${evidenceQuotes}` : ""}`;
    }),
  ];
  return lines.join("\n");
}

export function buildEvidencePacketFromRun(options: BuildOptions): EvidencePacket {
  const artifacts = extractRunArtifacts(options.runDir);
  const capture = readJsonFile(artifacts.captureJsonPath) as CaptureShape;
  const traceText = readTextFileIfExists(artifacts.tracePath);
  const returnBlockText = readTextFileIfExists(artifacts.returnBlockPath);
  const parsedReturn = parseNovaReturnBlock(returnBlockText);

  const candidate = extractCandidate(capture, parsedReturn.payload, options.runDir);
  const stageStatus = extractStageStatus(capture, parsedReturn.payload);
  const sources = extractSources(capture, parsedReturn.payload);
  const flags = collectFlags(capture, parsedReturn.payload);
  const claims = buildClaims(
    capture,
    parsedReturn.payload,
    artifacts,
    candidate,
    sources,
    stageStatus,
    flags,
  );
  const trace = buildTrace(capture, candidate, sources, stageStatus, flags, traceText);
  const highlights = buildHighlights(claims, capture, stageStatus);
  const parsedTrace = parseNovaTrace(traceText);

  const packet: EvidencePacket = {
    version: "1.0",
    createdAtISO: new Date().toISOString(),
    candidate,
    run: {
      runDir: options.runDir,
      sessionId:
        safeString(safeObject(safeObject(capture.artifacts).nova).sessionId) ??
        safeString(safeObject(capture.nova).sessionId),
      actId:
        safeString(safeObject(safeObject(capture.artifacts).nova).actId) ??
        safeString(safeObject(capture.nova).actId),
      replayHtml: artifacts.replayHtmlPath,
    },
    stageStatus,
    sources,
    flags,
    claims,
    novaReturn: {
      rawTextPath: artifacts.returnBlockPath,
      parsed: parsedReturn.payload ?? undefined,
      parseOk: parsedReturn.payload !== null,
    },
    trace,
    metrics: {
      thinkCount: parsedTrace.thinkCount,
      actionCounts: {
        ...parsedTrace.actionCounts,
        return: parsedTrace.returnCount,
      },
      evidenceSnippetsCount: claims.reduce(
        (total, claim) => total + claim.evidence.length,
        0,
      ),
      claimsCount: claims.length,
    },
    highlights,
    bedrockInput: {
      socialEvidencePacket: buildBedrockInput(candidate, stageStatus, flags, claims),
    },
  };

  debugLog("built evidence packet", {
    runDir: options.runDir,
    traceMode: packet.trace.mode,
    claims: packet.claims.length,
    flags: packet.flags,
  });

  return evidencePacketSchema.parse(packet);
}

export function saveEvidencePacket(
  options: BuildOptions,
): {
  packet: EvidencePacket;
  jsonPath: string;
  mdPath: string;
} {
  const packet = buildEvidencePacketFromRun(options);
  const jsonPath = path.join(options.runDir, "evidence_packet.json");
  const mdPath = path.join(options.runDir, "evidence_packet.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`, "utf-8");
  fs.writeFileSync(mdPath, renderEvidencePacketMarkdown(packet), "utf-8");

  const capturePath = path.join(options.runDir, "capture.json");
  if (fs.existsSync(capturePath)) {
    const capture = readJsonFile(capturePath);
    const nextArtifacts = safeObject(capture.artifacts);
    nextArtifacts.evidencePacket = { saved: true, path: "evidence_packet.json" };
    nextArtifacts.evidencePacketMarkdown = { saved: true, path: "evidence_packet.md" };
    capture.artifacts = nextArtifacts;
    fs.writeFileSync(capturePath, `${JSON.stringify(capture, null, 2)}\n`, "utf-8");
  }

  return { packet, jsonPath, mdPath };
}

export function buildSocialEvidencePacket(options: BuildOptions): EvidencePacket {
  return buildEvidencePacketFromRun(options);
}

export function writeSocialEvidencePacket(options: BuildOptions): {
  packet: EvidencePacket;
  evidencePacketPath: string;
  evidencePacketMarkdownPath: string;
} {
  const { packet, jsonPath, mdPath } = saveEvidencePacket(options);
  return {
    packet,
    evidencePacketPath: jsonPath,
    evidencePacketMarkdownPath: mdPath,
  };
}
