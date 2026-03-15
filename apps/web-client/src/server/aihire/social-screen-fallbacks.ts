import fs from "node:fs";
import path from "node:path";

type LooseRecord = Record<string, unknown>;
type StageStatus = "ok" | "partial" | "blocked" | "skipped";
type CitationSource = "linkedin" | "github" | "portfolio" | "web" | "system";

function safeObject(value: unknown): LooseRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : {};
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeText(value: string, limit = 280): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

function stageStatusValue(value: unknown): StageStatus {
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

export function describeJsonParseError(text: string, error: unknown): string {
  if (!(error instanceof SyntaxError) || typeof (error as SyntaxError & { pos?: number }).pos !== "number") {
    return error instanceof Error ? error.message : String(error);
  }
  const pos = (error as SyntaxError & { pos: number }).pos;
  const start = Math.max(0, pos - 120);
  const end = Math.min(text.length, pos + 120);
  const excerpt = text.slice(start, end).replace(/\s+/g, " ");
  return `${error.message} near: ${excerpt}`;
}

function extractJsonObjectCandidate(rawText: string): string | null {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return rawText.slice(start, end + 1);
}

export function parseJsonWithDiagnostics<T = unknown>(
  rawText: string,
  label: string,
): T {
  try {
    return JSON.parse(rawText) as T;
  } catch (firstError) {
    const candidate = extractJsonObjectCandidate(rawText);
    if (candidate && candidate !== rawText) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // fall through to detailed error
      }
    }
    throw new Error(`${label}: ${describeJsonParseError(rawText, firstError)}`);
  }
}

export function readJsonFileWithDiagnostics<T = unknown>(
  filePath: string,
  label?: string,
): T {
  const text = fs.readFileSync(filePath, "utf-8");
  return parseJsonWithDiagnostics<T>(text, label ?? filePath);
}

export function writeJsonAtomic(filePath: string, payload: unknown): void {
  const nextText = `${JSON.stringify(payload, null, 2)}\n`;
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, nextText, "utf-8");
  JSON.parse(fs.readFileSync(tmpPath, "utf-8"));
  fs.renameSync(tmpPath, filePath);
}

export function parseJsonlText(
  text: string,
): { events: LooseRecord[]; parseErrors: Array<{ line: number; message: string; excerpt: string }> } {
  const events: LooseRecord[] = [];
  const parseErrors: Array<{ line: number; message: string; excerpt: string }> = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        events.push(parsed as LooseRecord);
      } else {
        parseErrors.push({
          line: index + 1,
          message: "Line did not parse to a JSON object",
          excerpt: line.slice(0, 200),
        });
      }
    } catch (error) {
      parseErrors.push({
        line: index + 1,
        message: error instanceof Error ? error.message : String(error),
        excerpt: line.slice(0, 200),
      });
    }
  }

  return { events, parseErrors };
}

function collectStrings(payload: LooseRecord, ...keys: string[]): string[] {
  return keys
    .flatMap((key) => safeArray<string>(payload[key]))
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => normalizeText(item));
}

export function buildMinimalEvidencePacketFromCapture(
  runDir: string,
  capture: LooseRecord,
  reason?: string,
): LooseRecord {
  const inputs = safeObject(capture.inputs);
  const outputs = safeObject(capture.outputs);
  const stageStatusPayload = safeObject(outputs.stageStatus);
  const linkedin = safeObject(outputs.linkedin);
  const github = safeObject(outputs.github);
  const portfolio = safeObject(outputs.portfolio);
  const web = safeObject(outputs.web);
  const flags = safeArray<string>(outputs.flags).filter(Boolean);
  const candidateLabel = cleanText(inputs.candidateName) ?? path.basename(path.dirname(runDir));
  const candidateId = cleanText(inputs.candidateId);
  const stageStatus = {
    linkedin: stageStatusValue(stageStatusPayload.linkedin ?? linkedin.status),
    github: stageStatusValue(stageStatusPayload.github ?? github.status),
    portfolio: stageStatusValue(stageStatusPayload.portfolio ?? portfolio.status),
    web: stageStatusValue(stageStatusPayload.web ?? web.status),
  };

  const claims: LooseRecord[] = [];
  const pushClaim = (
    severity: "info" | "warning" | "critical" | "verified",
    title: string,
    statement: string,
    evidence: LooseRecord[],
  ) => {
    if (claims.length >= 12) return;
    claims.push({
      id: `fallback_${claims.length + 1}`,
      severity,
      title,
      statement,
      evidence,
    });
  };

  const portfolioEvidence = collectStrings(portfolio, "evidence", "warnings");
  const githubEvidence = collectStrings(github, "evidence", "warnings");
  const linkedinEvidence = collectStrings(linkedin, "evidence", "warnings");

  const mismatchQuote =
    portfolioEvidence.find((item) => /does not match|mismatch|different/i.test(item)) ??
    portfolioEvidence.find((item) => /owner name/i.test(item));
  if (flags.includes("IDENTITY_MISMATCH_WEBSITE_OWNER") || portfolio.mismatchFlag === true) {
    pushClaim(
      "critical",
      "Portfolio owner mismatch",
      `Portfolio appears owned by ${cleanText(portfolio.ownerName) ?? "another person"}, not ${candidateLabel}.`,
      [
        {
          source: "portfolio",
          quote:
            mismatchQuote ??
            `Visible portfolio owner name appears to be '${cleanText(portfolio.ownerName) ?? "unknown"}', which does not match candidate label '${candidateLabel}'.`,
          url: cleanText(portfolio.url),
          artifactPath: path.join(runDir, "capture.json"),
        },
      ],
    );
  }

  for (const [stage, status] of Object.entries(stageStatus) as Array<[string, StageStatus]>) {
    if (status === "ok") continue;
    const source = stage === "web" ? "system" : stage;
    pushClaim(
      status === "blocked" ? "warning" : "info",
      `${stage.charAt(0).toUpperCase() + stage.slice(1)} stage ${status}`,
      `${stage.charAt(0).toUpperCase() + stage.slice(1)} stage ${status}; evidence is limited.`,
      [
        {
          source,
          quote: `${stage} stage status: ${status}.`,
          artifactPath: path.join(runDir, "capture.json"),
        },
      ],
    );
  }

  for (const [source, evidence, url] of [
    ["linkedin", linkedinEvidence, cleanText(linkedin.url)],
    ["github", githubEvidence, cleanText(github.url)],
    ["portfolio", portfolioEvidence, cleanText(portfolio.url)],
  ] as Array<[CitationSource, string[], string | undefined]>) {
    for (const quote of evidence.slice(0, 2)) {
      pushClaim("info", `${source} evidence`, quote, [
        {
          source,
          quote,
          url,
          artifactPath: path.join(runDir, "capture.json"),
        },
      ]);
    }
  }

  if (reason) {
    pushClaim("warning", "Packet build failed", reason, [
      {
        source: "system",
        quote: reason,
        artifactPath: path.join(runDir, "capture.json"),
      },
    ]);
  }

  const positives = claims
    .filter((claim) => claim.severity === "info" || claim.severity === "verified")
    .map((claim) => String(claim.statement))
    .slice(0, 8);
  const concerns = claims
    .filter((claim) => claim.severity === "warning" || claim.severity === "critical")
    .map((claim) => String(claim.statement))
    .slice(0, 8);

  const packet = {
    version: "1.0",
    createdAtISO: new Date().toISOString(),
    candidate: {
      label: candidateLabel,
      candidateId,
    },
    run: {
      runDir,
      replayHtml: fs.existsSync(path.join(runDir, "replay.html"))
        ? path.join(runDir, "replay.html")
        : undefined,
    },
    stageStatus,
    sources: {
      linkedin: cleanText(linkedin.url) ? { url: cleanText(linkedin.url), found: Boolean(linkedin.found) } : undefined,
      github: cleanText(github.url) ? { url: cleanText(github.url), found: Boolean(github.found) } : undefined,
      portfolio: cleanText(portfolio.url)
        ? {
            url: cleanText(portfolio.url),
            found: Boolean(portfolio.found),
            ownerName: cleanText(portfolio.ownerName),
          }
        : undefined,
      web: safeArray<string>(web.queries).length ? { queries: safeArray<string>(web.queries) } : undefined,
    },
    flags,
    claims,
    novaReturn: {
      rawTextPath: path.join(runDir, "nova_return_block.txt"),
      parseOk: false,
    },
    trace: {
      mode: "synthetic",
      summary: reason
        ? `Evidence packet fallback created because packet build failed: ${normalizeText(reason, 180)}`
        : "Evidence packet fallback created from capture.json.",
      steps: [
        {
          stage: "capture",
          action: "Loaded capture artifact",
          observed: "Created fallback evidence packet from capture.json.",
        },
        {
          stage: "reasoner",
          action: "Prepared degraded evidence packet",
          observed: reason ? normalizeText(reason, 180) : "Packet build fallback was not required.",
        },
      ],
    },
    metrics: {
      thinkCount: 0,
      actionCounts: {
        agentClick: 0,
        agentType: 0,
        agentScroll: 0,
        goToUrl: 0,
        return: 0,
      },
      evidenceSnippetsCount: claims.reduce(
        (total, claim) => total + safeArray(safeObject(claim).evidence).length,
        0,
      ),
      claimsCount: claims.length,
    },
    highlights: {
      positives,
      concerns,
      missing: Object.entries(stageStatus)
        .filter(([, status]) => status !== "ok")
        .map(([stage, status]) => `${stage} stage status: ${status}.`)
        .slice(0, 12),
    },
    bedrockInput: {
      socialEvidencePacket: [
        `Candidate Label: ${candidateLabel}`,
        `Stage Status: linkedin=${stageStatus.linkedin}, github=${stageStatus.github}, portfolio=${stageStatus.portfolio}, web=${stageStatus.web}`,
        `Flags: ${flags.length ? flags.join(", ") : "none"}`,
        ...claims.slice(0, 8).map((claim) => `- [${claim.severity}] ${claim.title}: ${claim.statement}`),
      ].join("\n"),
    },
  };

  return packet;
}

export function renderMinimalEvidencePacketMarkdown(packet: LooseRecord): string {
  const candidate = safeObject(packet.candidate);
  const stageStatus = safeObject(packet.stageStatus);
  const claims = safeArray<LooseRecord>(packet.claims);
  return [
    `# Social Evidence Packet`,
    ``,
    `Candidate: ${cleanText(candidate.label) ?? "Unknown"}`,
    `Created: ${cleanText(packet.createdAtISO) ?? ""}`,
    ``,
    `## Stage Status`,
    `- LinkedIn: ${cleanText(stageStatus.linkedin) ?? "unknown"}`,
    `- GitHub: ${cleanText(stageStatus.github) ?? "unknown"}`,
    `- Portfolio: ${cleanText(stageStatus.portfolio) ?? "unknown"}`,
    `- Web: ${cleanText(stageStatus.web) ?? "unknown"}`,
    ``,
    `## Claims`,
    ...claims.slice(0, 12).map((claim) => `- [${cleanText(claim.severity) ?? "info"}] ${cleanText(claim.statement) ?? ""}`),
    ``,
  ].join("\n");
}

export function buildMinimalReportFromPacket(
  packet: LooseRecord,
  options?: { candidateId?: string; error?: string },
): LooseRecord {
  const candidate = safeObject(packet.candidate);
  const stageStatus = safeObject(packet.stageStatus);
  const claims = safeArray<LooseRecord>(packet.claims);
  const flags = safeArray<string>(packet.flags);
  const criticalClaims = claims.filter((claim) => cleanText(claim.severity) === "critical");
  const warningClaims = claims.filter((claim) => cleanText(claim.severity) === "warning");
  const verifiedFindings = claims
    .filter((claim) => {
      const severity = cleanText(claim.severity);
      return severity === "info" || severity === "verified";
    })
    .slice(0, 8)
    .map((claim) => ({
      text: cleanText(claim.statement) ?? cleanText(claim.title) ?? "Finding",
      severity: "info",
      citations: safeArray<LooseRecord>(claim.evidence),
    }));
  const concerns = [...criticalClaims, ...warningClaims].slice(0, 8).map((claim) => ({
    text: cleanText(claim.statement) ?? cleanText(claim.title) ?? "Concern",
    severity: cleanText(claim.severity) === "critical" ? "critical" : "warning",
    citations: safeArray<LooseRecord>(claim.evidence),
  }));

  const risk =
    flags.includes("IDENTITY_MISMATCH_WEBSITE_OWNER") || criticalClaims.length > 0
      ? "high"
      : warningClaims.length > 0
        ? "medium"
        : "medium";

  const nextSteps = new Set<string>();
  if (flags.includes("IDENTITY_MISMATCH_WEBSITE_OWNER")) {
    nextSteps.add("Verify portfolio ownership with the candidate before relying on portfolio evidence.");
    nextSteps.add("Request candidate confirmation for any portfolio or personal website links.");
  }
  for (const [stage, status] of Object.entries(stageStatus)) {
    if (status !== "ok") {
      nextSteps.add(`Verify ${stage} evidence manually because the captured stage status is ${status}.`);
    }
  }
  if (options?.error) {
    nextSteps.add("Review degraded report notes because one or more artifact parsers failed during the run.");
  }

  return {
    candidateId: cleanText(options?.candidateId) ?? cleanText(candidate.candidateId),
    candidateLabel: cleanText(candidate.label) ?? "Unknown candidate",
    socialScore: risk === "high" ? 18 : 55,
    risk,
    recommendation: risk === "high" ? "REVIEW" : "REVIEW",
    verifiedFindings,
    concerns,
    nextSteps: [...nextSteps].slice(0, 12),
    citations: [...verifiedFindings.flatMap((finding) => finding.citations), ...concerns.flatMap((concern) => concern.citations)].slice(0, 24),
    flags,
    stageStatus: {
      linkedin: cleanText(stageStatus.linkedin) ?? "skipped",
      github: cleanText(stageStatus.github) ?? "skipped",
      portfolio: cleanText(stageStatus.portfolio) ?? "skipped",
      web: cleanText(stageStatus.web) ?? "skipped",
    },
    provider: "deterministic-fallback",
    modelId: cleanText(process.env.BEDROCK_MODEL_ID) ?? "deterministic-fallback",
    parseOk: false,
    validationOk: true,
    usedFallback: true,
    degraded: true,
    metrics: {
      timestampISO: new Date().toISOString(),
      requestId: "local",
    },
    error: cleanText(options?.error),
  };
}
