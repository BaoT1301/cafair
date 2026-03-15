import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { applyDeterministicSocialCapture } from "./deterministic-social-capture";
import {
  buildMinimalEvidencePacketFromCapture,
  buildMinimalReportFromPacket,
  parseJsonWithDiagnostics,
  readJsonFileWithDiagnostics,
  renderMinimalEvidencePacketMarkdown,
  writeJsonAtomic,
} from "./social-screen-fallbacks";
import {
  appendSocialScreenRunEvent,
  createSocialScreenRunManifest,
  findRepoRoot,
  getSocialScreenRunManifest,
  type SocialScreenRunEvent,
  type SocialScreenRunManifest,
  updateSocialScreenRunManifest,
  writeSocialScreenRunManifest,
} from "./social-screen-run-store";
import type { SocialScreenCitation, SocialScreenRunRequest, SocialScreenRunResponse, SocialScreenStage, SocialScreenStreamEvent } from "./social-screen/types";

export type StartSocialScreenRunInput = SocialScreenRunRequest;

function cleanText(value?: string): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function repoRelative(filePath: string): string {
  const repoRoot = findRepoRoot();
  return path.relative(repoRoot, filePath) || filePath;
}

function appendEvent(
  runId: string,
  type: SocialScreenStreamEvent["type"],
  message: string,
  extra?: {
    stage?: SocialScreenStage;
    phase?: string;
    data?: Record<string, unknown>;
  },
): void {
  appendSocialScreenRunEvent(runId, {
    type,
    message,
    ...extra,
  });
}

function appendArtifactParseError(
  runId: string,
  stage: "capture" | "reasoner",
  label: string,
  rawText: string,
  error: unknown,
): void {
  const excerpt = rawText.slice(0, 220).replace(/\s+/g, " ");
  appendEvent(runId, "log", `${label} parse failed.`, {
    stage,
    data: {
      label,
      size: rawText.length,
      error: error instanceof Error ? error.message : String(error),
      excerpt,
    },
  });
}

function anyMeaningfulStage(input: StartSocialScreenRunInput): boolean {
  if (input.mode === "demo") {
    return true;
  }
  if (input.mode === "replay" && cleanText(input.replayRunDir)) {
    return true;
  }
  return Boolean(
    cleanText(input.linkedinUrl) ||
      cleanText(input.githubUrl) ||
      cleanText(input.portfolioUrl) ||
      (input.webQueries ?? []).some((query) => cleanText(query)),
  );
}

function buildCaptureCommand(
  input: StartSocialScreenRunInput,
  runDir: string,
): { cmd: string; args: string[] } {
  const args = [
    "apps/llm/agents/scripts/run-social-capture-nova.py",
    input.candidateLabel,
    "--out-dir",
    runDir,
    "--save-trace",
    "--pretty",
  ];

  if (cleanText(input.linkedinUrl)) {
    args.push("--linkedin", cleanText(input.linkedinUrl)!);
  }
  if (cleanText(input.githubUrl)) {
    args.push("--github", cleanText(input.githubUrl)!);
  }
  if (cleanText(input.portfolioUrl)) {
    args.push("--portfolio-url", cleanText(input.portfolioUrl)!);
  }
  for (const query of input.webQueries ?? []) {
    if (cleanText(query)) args.push("--web-query", cleanText(query)!);
  }
  if (input.localBrowser) args.push("--local-browser");
  if (input.manualLinkedinLogin) args.push("--manual-linkedin-login");
  if (input.traceRedact) args.push("--trace-redact", input.traceRedact);

  return {
    cmd: "python3",
    args,
  };
}

function shouldEmitLogLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("[INFO]") || trimmed.startsWith("[WARN]") || trimmed.startsWith("[ERROR]")) {
    return true;
  }
  if (trimmed.includes("Running on Nova Act") || trimmed.includes("Created workflow run")) {
    return true;
  }
  if (trimmed.includes("Wrote social capture artifact")) {
    return true;
  }
  return false;
}

function ensureTraceArtifacts(runDir: string): void {
  const tracePath = path.join(runDir, "nova_trace.txt");
  const rawTracePath = path.join(runDir, "nova_trace_raw.txt");
  if (!fs.existsSync(rawTracePath)) {
    fs.writeFileSync(
      rawTracePath,
      "No live Nova trace was captured for this workflow run. Synthetic packet trace will be used.\n",
      "utf-8",
    );
  }
  if (!fs.existsSync(tracePath)) {
    fs.writeFileSync(
      tracePath,
      "No live Nova trace was captured for this workflow run. Synthetic packet trace will be used.\n",
      "utf-8",
    );
  }
}

function parseOutputLines(
  runId: string,
  stageState: { currentStage?: "linkedin" | "github" | "portfolio" | "web" },
  chunk: string,
): void {
  for (const rawLine of chunk.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (shouldEmitLogLine(line)) {
      appendEvent(runId, "log", line, {
        stage: stageState.currentStage,
        data: { line },
      });
    }

    const lower = line.toLowerCase();
    if (lower.includes("linkedin")) stageState.currentStage = "linkedin";
    else if (lower.includes("github")) stageState.currentStage = "github";
    else if (lower.includes("portfolio")) stageState.currentStage = "portfolio";

    const captureMatch = line.match(/\[INFO\] Wrote social capture artifact:\s+(.+)$/);
    if (captureMatch?.[1]) {
      appendEvent(runId, "status", "Capture artifact written.", {
        stage: "capture",
        phase: "capture_saved",
        data: {
          capturePath: captureMatch[1].trim(),
        },
      });
    }
  }
}

async function runCapture(
  manifest: SocialScreenRunManifest,
  input: StartSocialScreenRunInput,
): Promise<void> {
  const repoRoot = findRepoRoot();
  const { cmd, args } = buildCaptureCommand(input, manifest.runDir);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        USE_REAL_BEDROCK: input.useRealBedrock ? "true" : process.env.USE_REAL_BEDROCK,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stageState: { currentStage?: "linkedin" | "github" | "portfolio" | "web" } = {};
    const heartbeat = setInterval(() => {
      appendEvent(runIdFromManifest(manifest), "status", "Capture still running.", {
        stage: stageState.currentStage ?? "capture",
        phase: "running",
        data: { status: "running" },
      });
    }, 10000);

    child.stdout.on("data", (chunk: Buffer | string) => {
      parseOutputLines(runIdFromManifest(manifest), stageState, chunk.toString());
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      parseOutputLines(runIdFromManifest(manifest), stageState, chunk.toString());
    });

    child.on("error", (error) => reject(error));

    child.on("close", (code) => {
      clearInterval(heartbeat);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Social capture exited with code ${code ?? "unknown"}`));
    });
  });
}

function ensureDeterministicArtifacts(runDir: string): void {
  const returnBlockPath = path.join(runDir, "nova_return_block.txt");
  if (!fs.existsSync(returnBlockPath)) {
    fs.writeFileSync(returnBlockPath, "BEGIN_CAPTURE_JSON\n{}\nEND_CAPTURE_JSON\n", "utf-8");
  }
  ensureTraceArtifacts(runDir);
}

async function runDeterministicCaptureFallback(
  manifest: SocialScreenRunManifest,
  input: StartSocialScreenRunInput,
): Promise<void> {
  const result = await applyDeterministicSocialCapture({
    runDir: manifest.runDir,
    candidateId: cleanText(input.candidateId),
    candidateLabel: cleanText(input.candidateLabel)!,
    linkedinUrl: cleanText(input.linkedinUrl),
    githubUrl: cleanText(input.githubUrl),
    portfolioUrl: cleanText(input.portfolioUrl),
    webQueries: (input.webQueries ?? []).map((query) => query.trim()).filter(Boolean),
  });
  ensureDeterministicArtifacts(manifest.runDir);

  appendEvent(manifest.runId, "status", "Deterministic capture updated run artifacts.", {
    stage: "capture",
    phase: "deterministic_enrichment",
    data: {
      capturePath: repoRelative(result.capturePath),
      flags: result.flags,
    },
  });

  for (const finding of result.findings.slice(0, 8)) {
    appendEvent(manifest.runId, "finding", finding.text, {
      stage: finding.stage,
      data: {
        severity: finding.severity,
        text: finding.text,
        citations: finding.citations as SocialScreenCitation[],
      },
    });
  }
}

function writeMinimalEvidencePacket(
  manifest: SocialScreenRunManifest,
  reason: string,
): {
  packet: Record<string, unknown>;
  evidencePacketPath: string;
  evidencePacketMarkdownPath: string;
} {
  const capturePath = path.join(manifest.runDir, "capture.json");
  const capture = readJsonFileWithDiagnostics<Record<string, unknown>>(capturePath, "capture.json");
  const packet = buildMinimalEvidencePacketFromCapture(manifest.runDir, capture, reason);
  const evidencePacketPath = path.join(manifest.runDir, "evidence_packet.json");
  const evidencePacketMarkdownPath = path.join(manifest.runDir, "evidence_packet.md");
  writeJsonAtomic(evidencePacketPath, packet);
  fs.writeFileSync(
    evidencePacketMarkdownPath,
    renderMinimalEvidencePacketMarkdown(packet),
    "utf-8",
  );
  return { packet, evidencePacketPath, evidencePacketMarkdownPath };
}

function copyIfExists(sourcePath: string, targetPath: string): void {
  if (!fs.existsSync(sourcePath)) return;
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function resolveReplaySource(
  manifest: SocialScreenRunManifest,
  input: StartSocialScreenRunInput,
): string {
  const explicit = cleanText(input.replayRunDir);
  if (explicit) {
    const resolved = path.resolve(findRepoRoot(), explicit);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Replay source run dir not found: ${resolved}`);
    }
    return resolved;
  }

  const candidateDir = path.dirname(manifest.runDir);
  const candidates = fs.existsSync(candidateDir)
    ? fs
        .readdirSync(candidateDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== manifest.runId)
        .map((entry) => path.join(candidateDir, entry.name))
        .filter((dir) => fs.existsSync(path.join(dir, "report.json")))
        .sort()
    : [];

  const latest = candidates.at(-1);
  if (!latest) {
    throw new Error("Replay mode requested but no previous run with report.json was found.");
  }
  return latest;
}

async function runReplayMode(
  manifest: SocialScreenRunManifest,
  input: StartSocialScreenRunInput,
): Promise<void> {
  const sourceRunDir = resolveReplaySource(manifest, input);
  const filesToCopy = [
    "capture.json",
    "evidence_packet.json",
    "evidence_packet.md",
    "nova_trace.txt",
    "nova_trace_raw.txt",
    "nova_return_block.txt",
    "report.json",
    "bedrock_input.txt",
    "replay.html",
  ];

  for (const fileName of filesToCopy) {
    copyIfExists(path.join(sourceRunDir, fileName), path.join(manifest.runDir, fileName));
  }

  const capturePath = path.join(manifest.runDir, "capture.json");
  const evidencePacketPath = path.join(manifest.runDir, "evidence_packet.json");
  const evidencePacketMarkdownPath = path.join(manifest.runDir, "evidence_packet.md");
  const reportPath = path.join(manifest.runDir, "report.json");
  const packet = JSON.parse(fs.readFileSync(evidencePacketPath, "utf-8")) as {
    stageStatus: Record<string, string>;
    claims: Array<{
      severity: string;
      statement: string;
      title: string;
      evidence: Array<Record<string, unknown>>;
    }>;
  };
  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as {
    risk: string;
    recommendation: string;
    flags?: string[];
  };

  updateSocialScreenRunManifest(manifest.runId, (next) => ({
    ...next,
    stageStatus: {
      linkedin: packet.stageStatus.linkedin ?? "skipped",
      github: packet.stageStatus.github ?? "skipped",
      portfolio: packet.stageStatus.portfolio ?? "skipped",
      web: packet.stageStatus.web ?? "skipped",
    },
    paths: {
      ...next.paths,
      captureJson: capturePath,
      evidencePacketJson: evidencePacketPath,
      evidencePacketMarkdown: evidencePacketMarkdownPath,
      reportJson: reportPath,
    },
  }));

  appendEvent(manifest.runId, "status", "Replay mode copied an existing social screen run.", {
    stage: "capture",
    phase: "replay_loaded",
    data: {
      sourceRunDir: repoRelative(sourceRunDir),
    },
  });

  for (const stage of ["linkedin", "github", "portfolio", "web"] as const) {
    appendEvent(manifest.runId, "status", `${stage} stage ${packet.stageStatus[stage] ?? "skipped"}.`, {
      stage,
      phase: "stage_complete",
      data: { status: packet.stageStatus[stage] ?? "skipped" },
    });
  }

  for (const claim of packet.claims.slice(0, 8)) {
    appendEvent(manifest.runId, "finding", claim.statement, {
      stage: claim.evidence[0]?.source === "system"
        ? "reasoner"
        : (claim.evidence[0]?.source as "linkedin" | "github" | "portfolio" | "web" | undefined),
      data: {
        severity: claim.severity,
        title: claim.title,
        citations: claim.evidence,
      },
    });
  }

  updateSocialScreenRunManifest(manifest.runId, (next) => ({
    ...next,
    status: "completed",
    finishedAtISO: new Date().toISOString(),
  }));

  appendEvent(manifest.runId, "done", "Final report ready.", {
    stage: "reasoner",
    phase: "completed",
    data: {
      reportPath: repoRelative(reportPath),
      risk: report.risk,
      recommendation: report.recommendation,
      flags: report.flags ?? [],
    },
  });
}

function execCommand(
  cmd: string,
  args: string[],
  env?: Record<string, string | undefined>,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      {
        cwd: findRepoRoot(),
        env: {
          ...process.env,
          ...env,
        },
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `${cmd} ${args.join(" ")} failed: ${
                stderr?.trim() || error.message
              }`,
            ),
          );
          return;
        }
        resolve({
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
        });
      },
    );
  });
}

function runIdFromManifest(manifest: SocialScreenRunManifest): string {
  return manifest.runId;
}

export type StartSocialScreenRunResult = Omit<SocialScreenRunResponse, "ok">;

export async function startSocialScreenRun(
  input: StartSocialScreenRunInput,
): Promise<StartSocialScreenRunResult> {
  if (input.mode !== "demo" && !cleanText(input.candidateLabel)) {
    throw new Error("candidateLabel is required");
  }
  if (!anyMeaningfulStage(input)) {
    throw new Error("Provide at least one of linkedinUrl, githubUrl, portfolioUrl, or webQueries.");
  }
  if (input.manualLinkedinLogin) {
    throw new Error("manualLinkedinLogin is not supported through the API orchestrator.");
  }

  if (input.mode === "demo") {
    return {
      runId: "demo",
      runDir: path.join(findRepoRoot(), "apps", "llm", "agents", ".runs", "social", "demo", "demo"),
      streamUrl: "/api/aihire/social-screen/stream?runId=demo",
      reportUrl: "/api/aihire/social-screen/report?runId=demo",
      status: "completed",
    };
  }

  const manifest = createSocialScreenRunManifest({
    candidateId: cleanText(input.candidateId),
    candidateLabel: cleanText(input.candidateLabel)!,
  });

  appendEvent(manifest.runId, "status", "Run queued.", {
    stage: "capture",
    phase: "started",
    data: { status: "queued" },
  });

  void runSocialScreenOrchestrator(manifest.runId, input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    appendEvent(manifest.runId, "error", message, {
      stage: "capture",
      data: { status: "failed" },
    });
    updateSocialScreenRunManifest(manifest.runId, (next) => ({
      ...next,
      status: "failed",
      errors: [...next.errors, message],
      finishedAtISO: new Date().toISOString(),
    }));
  });

  return {
    runId: manifest.runId,
    runDir: manifest.runDir,
    streamUrl: `/api/aihire/social-screen/stream?runId=${encodeURIComponent(manifest.runId)}`,
    reportUrl: `/api/aihire/social-screen/report?runId=${encodeURIComponent(manifest.runId)}`,
    status: manifest.status,
  };
}

export async function runSocialScreenOrchestrator(
  runId: string,
  input: StartSocialScreenRunInput,
): Promise<void> {
  const manifest = getSocialScreenRunManifest(runId);
  if (!manifest) {
    throw new Error(`Run not found: ${runId}`);
  }

  writeSocialScreenRunManifest({
    ...manifest,
    status: "running",
  });
  appendEvent(runId, "status", "Capture started.", {
    stage: "capture",
    phase: "started",
    data: { status: "running" },
  });

  try {
    if (input.mode === "replay") {
      await runReplayMode(manifest, input);
      return;
    }

    if (input.mode === "deterministic") {
      appendEvent(runId, "status", "Running deterministic capture collectors.", {
        stage: "capture",
        phase: "started",
        data: { status: "running", mode: "deterministic" },
      });
      await runDeterministicCaptureFallback(manifest, input);
    } else {
      await runCapture(manifest, input);
      ensureTraceArtifacts(manifest.runDir);
      await runDeterministicCaptureFallback(manifest, input);
    }

    const capturePath = path.join(manifest.runDir, "capture.json");
    updateSocialScreenRunManifest(runId, (next) => ({
      ...next,
      paths: {
        ...next.paths,
        captureJson: capturePath,
      },
    }));
    appendEvent(runId, "status", "Capture finished. Building evidence packet.", {
      stage: "capture",
      phase: "capture_saved",
      data: { status: "completed", captureJson: repoRelative(capturePath) },
    });

    let packet: {
      stageStatus: {
        linkedin: string;
        github: string;
        portfolio: string;
        web: string;
      };
      claims: Array<{
        severity: string;
        title: string;
        statement: string;
        evidence: Array<Record<string, unknown>>;
      }>;
      bedrockInput: { socialEvidencePacket: string };
      trace: { mode: string };
      metrics: {
        thinkCount: number;
        actionCounts: Record<string, number>;
      };
    };
    let evidencePacketPath = path.join(manifest.runDir, "evidence_packet.json");
    let evidencePacketMarkdownPath = path.join(manifest.runDir, "evidence_packet.md");

    try {
      const evidenceResult = await execCommand("./node_modules/.bin/tsx", [
        "apps/llm/agents/scripts/build-evidence-packet.ts",
        "--run-dir",
        manifest.runDir,
        "--pretty",
      ]);
      if (process.env.DEBUG === "1" && evidenceResult.stdout.trim()) {
        try {
          parseJsonWithDiagnostics(evidenceResult.stdout, "build-evidence-packet stdout");
        } catch (error) {
          appendArtifactParseError(runId, "capture", "build-evidence-packet stdout", evidenceResult.stdout, error);
        }
      }
      if (!fs.existsSync(evidencePacketPath)) {
        throw new Error(`evidence_packet.json was not written in ${manifest.runDir}`);
      }
      const savedPacket = readJsonFileWithDiagnostics<typeof packet>(evidencePacketPath, "evidence_packet.json");
      packet = savedPacket;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      appendEvent(runId, "error", "packet build failed", {
        stage: "capture",
        phase: "packet_failed",
        data: { details: reason },
      });
      const fallbackPacket = writeMinimalEvidencePacket(manifest, reason);
      packet = fallbackPacket.packet as typeof packet;
      evidencePacketPath = fallbackPacket.evidencePacketPath;
      evidencePacketMarkdownPath = fallbackPacket.evidencePacketMarkdownPath;
    }

    fs.writeFileSync(
      path.join(manifest.runDir, "bedrock_input.txt"),
      `${packet.bedrockInput.socialEvidencePacket}\n`,
      "utf-8",
    );

    updateSocialScreenRunManifest(runId, (next) => ({
      ...next,
      stageStatus: packet.stageStatus,
      paths: {
        ...next.paths,
        evidencePacketJson: evidencePacketPath,
        evidencePacketMarkdown: evidencePacketMarkdownPath,
      },
    }));

    for (const stage of ["linkedin", "github", "portfolio", "web"] as const) {
      appendEvent(runId, "status", `${stage} stage ${packet.stageStatus[stage]}.`, {
        stage,
        phase: "stage_complete",
        data: { status: packet.stageStatus[stage] },
      });
    }

    for (const claim of packet.claims.slice(0, 8)) {
      appendEvent(runId, "finding", claim.statement, {
        stage: claim.evidence[0]?.source === "system"
          ? "reasoner"
          : (claim.evidence[0]?.source as "linkedin" | "github" | "portfolio" | "web" | undefined),
        data: {
          severity: claim.severity,
          title: claim.title,
          citations: claim.evidence,
        },
      });
    }

    appendEvent(runId, "status", "Running final reasoner.", {
      stage: "reasoner",
      phase: "started",
      data: { status: "running" },
    });

    const reportPath = path.join(manifest.runDir, "report.json");
    const reasonerArgs = [
      "apps/llm/agents/scripts/run-social-evidence-reasoner-local.ts",
      "--run-dir",
      manifest.runDir,
      "--json-only",
      "--out-file",
      reportPath,
    ];
    if (cleanText(input.candidateId)) {
      reasonerArgs.push("--candidate-id", cleanText(input.candidateId)!);
    }
    if (cleanText(input.roleTitle)) {
      reasonerArgs.push("--role-title", cleanText(input.roleTitle)!);
    }
    if (cleanText(input.companyName)) {
      reasonerArgs.push("--company-name", cleanText(input.companyName)!);
    }

    let report: {
      risk: string;
      recommendation: string;
      flags?: string[];
    };
    try {
      const reasonerResult = await execCommand(
        "./node_modules/.bin/tsx",
        reasonerArgs,
        {
          USE_REAL_BEDROCK: input.useRealBedrock ? "true" : process.env.USE_REAL_BEDROCK,
          AWS_PROFILE: process.env.AWS_PROFILE,
          AWS_REGION: process.env.AWS_REGION,
          BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
        },
      );
      if (reasonerResult.stdout.trim()) {
        try {
          report = parseJsonWithDiagnostics<typeof report>(
            reasonerResult.stdout,
            "reasoner stdout",
          );
        } catch (error) {
          appendArtifactParseError(runId, "reasoner", "reasoner stdout", reasonerResult.stdout, error);
          report = readJsonFileWithDiagnostics<typeof report>(reportPath, "report.json");
        }
      } else {
        report = readJsonFileWithDiagnostics<typeof report>(reportPath, "report.json");
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      appendEvent(runId, "error", "reasoner failed; writing degraded report", {
        stage: "reasoner",
        phase: "fallback_report",
        data: { details: reason },
      });
      report = buildMinimalReportFromPacket(packet as Record<string, unknown>, {
        candidateId: cleanText(input.candidateId),
        error: reason,
      }) as typeof report;
      writeJsonAtomic(reportPath, report);
    }

    updateSocialScreenRunManifest(runId, (next) => ({
      ...next,
      status: "completed",
      finishedAtISO: new Date().toISOString(),
      paths: {
        ...next.paths,
        reportJson: reportPath,
      },
    }));

    appendEvent(runId, "done", "Final report ready.", {
      stage: "reasoner",
      phase: "completed",
      data: {
        reportPath: repoRelative(reportPath),
        risk: report.risk,
        recommendation: report.recommendation,
        flags: report.flags ?? [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateSocialScreenRunManifest(runId, (next) => ({
      ...next,
      status: "failed",
      finishedAtISO: new Date().toISOString(),
      errors: [...next.errors, message],
    }));
    appendEvent(runId, "error", message, {
      stage: "capture",
      phase: "failed",
      data: { status: "failed" },
    });
    throw error;
  }
}
