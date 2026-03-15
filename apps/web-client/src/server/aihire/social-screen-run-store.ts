import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "./social-screen-fallbacks";
import type {
  SocialScreenErrorEvent,
  SocialScreenFindingEvent,
  SocialScreenLogEvent,
  SocialScreenStatusEvent,
  SocialScreenDoneEvent,
  SocialScreenPingEvent,
  SocialScreenStage,
} from "./social-screen/types";

export type SocialScreenRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type SocialScreenRunEventType =
  | "status"
  | "finding"
  | "log"
  | "done"
  | "error"
  | "ping";

export type SocialScreenRunEvent =
  | SocialScreenStatusEvent
  | SocialScreenFindingEvent
  | SocialScreenLogEvent
  | SocialScreenDoneEvent
  | SocialScreenErrorEvent
  | SocialScreenPingEvent;

type SocialScreenRunEventDraft = {
  type: SocialScreenRunEventType;
  message: string;
  timestampISO?: string;
  stage?: SocialScreenStage;
  phase?: string;
  data?: Record<string, unknown>;
};

type LooseRecord = Record<string, unknown>;

export interface SocialScreenRunManifest {
  runId: string;
  candidateId?: string;
  candidateLabel: string;
  candidateSlug: string;
  runDir: string;
  status: SocialScreenRunStatus;
  startedAtISO: string;
  updatedAtISO: string;
  finishedAtISO?: string;
  stageStatus: {
    linkedin: string;
    github: string;
    portfolio: string;
    web: string;
  };
  paths: {
    runJson: string;
    eventsJsonl: string;
    captureJson?: string;
    evidencePacketJson?: string;
    evidencePacketMarkdown?: string;
    reportJson?: string;
  };
  errors: string[];
}

interface SocialScreenLatestPointer {
  runId: string;
  runDir: string;
  candidateSlug: string;
  candidateId?: string;
  candidateLabel: string;
  startedAtISO: string;
  updatedAtISO: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __aihireSocialScreenRunIndex: Map<string, string> | undefined;
}

const runIndex =
  globalThis.__aihireSocialScreenRunIndex ??
  new Map<string, string>();

if (!globalThis.__aihireSocialScreenRunIndex) {
  globalThis.__aihireSocialScreenRunIndex = runIndex;
}

function nowIso(): string {
  return new Date().toISOString();
}

const demoArtifactBasenames = new Set([
  "run.json",
  "events.jsonl",
  "capture.json",
  "evidence_packet.json",
  "evidence_packet.md",
  "report.json",
  "bedrock_input.txt",
  "nova_trace.txt",
  "nova_trace_raw.txt",
  "nova_return_block.txt",
  "replay.html",
]);

export function slugifyCandidateLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "candidate";
}

function makeTimestampForId(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function fileExists(filePath?: string): boolean {
  return Boolean(filePath && fs.existsSync(filePath));
}

export function findRepoRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    const agentsDir = path.join(current, "apps", "agents");
    const llmDir = path.join(current, "apps", "llm");
    const webDir = path.join(current, "apps", "web-client");
    if (fs.existsSync(agentsDir) && fs.existsSync(llmDir) && fs.existsSync(webDir)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not resolve repo root from: ${startDir}`);
    }
    current = parent;
  }
}

export function buildRunId(candidateSlug: string): string {
  return `ssr_${candidateSlug}_${makeTimestampForId()}`;
}

export function createSocialScreenRunManifest(input: {
  candidateId?: string;
  candidateLabel: string;
}): SocialScreenRunManifest {
  const repoRoot = findRepoRoot();
  const candidateSlug = slugifyCandidateLabel(input.candidateLabel);
  const runId = buildRunId(candidateSlug);
  const runDir = path.join(
    repoRoot,
    "apps",
    "llm",
    "agents",
    ".runs",
    "social",
    candidateSlug,
    runId,
  );

  fs.mkdirSync(runDir, { recursive: true });

  const manifest: SocialScreenRunManifest = {
    runId,
    candidateId: input.candidateId?.trim() || undefined,
    candidateLabel: input.candidateLabel.trim(),
    candidateSlug,
    runDir,
    status: "queued",
    startedAtISO: nowIso(),
    updatedAtISO: nowIso(),
    stageStatus: {
      linkedin: "queued",
      github: "queued",
      portfolio: "queued",
      web: "skipped",
    },
    paths: {
      runJson: path.join(runDir, "run.json"),
      eventsJsonl: path.join(runDir, "events.jsonl"),
    },
    errors: [],
  };

  fs.writeFileSync(manifest.paths.eventsJsonl, "", "utf-8");
  writeSocialScreenRunManifest(manifest);
  runIndex.set(runId, manifest.paths.runJson);
  return manifest;
}

function writeLatestPointers(manifest: SocialScreenRunManifest): void {
  const repoRoot = findRepoRoot();
  const baseDir = path.join(repoRoot, "apps", "llm", "agents", ".runs", "social");
  const payload: SocialScreenLatestPointer = {
    runId: manifest.runId,
    runDir: manifest.runDir,
    candidateSlug: manifest.candidateSlug,
    candidateId: manifest.candidateId,
    candidateLabel: manifest.candidateLabel,
    startedAtISO: manifest.startedAtISO,
    updatedAtISO: manifest.updatedAtISO,
  };

  fs.writeFileSync(
    path.join(baseDir, "_latest.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
  fs.writeFileSync(
    path.join(baseDir, manifest.candidateSlug, "_latest.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
}

export function writeSocialScreenRunManifest(
  manifest: SocialScreenRunManifest,
): SocialScreenRunManifest {
  const next: SocialScreenRunManifest = {
    ...manifest,
    updatedAtISO: nowIso(),
  };
  fs.writeFileSync(next.paths.runJson, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  runIndex.set(next.runId, next.paths.runJson);
  writeLatestPointers(next);
  return next;
}

function readLatestPointer(candidate?: string): SocialScreenLatestPointer | null {
  const repoRoot = findRepoRoot();
  const baseDir = path.join(repoRoot, "apps", "llm", "agents", ".runs", "social");
  const candidateSlug = candidate?.trim();
  const pointerPath = candidateSlug
    ? path.join(baseDir, candidateSlug, "_latest.json")
    : path.join(baseDir, "_latest.json");

  if (!fs.existsSync(pointerPath)) return null;
  return JSON.parse(fs.readFileSync(pointerPath, "utf-8")) as SocialScreenLatestPointer;
}

function tryReadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function findLatestSuccessfulRunDir(candidateSlug?: string): string | null {
  const repoRoot = findRepoRoot();
  const baseDir = path.join(repoRoot, "apps", "llm", "agents", ".runs", "social");
  const candidateDirs = candidateSlug
    ? [path.join(baseDir, candidateSlug)]
    : fs.existsSync(baseDir)
      ? fs.readdirSync(baseDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(baseDir, entry.name))
      : [];

  let bestDir: string | null = null;
  let bestMtime = -1;
  for (const candidateDir of candidateDirs) {
    if (!fs.existsSync(candidateDir)) continue;
    for (const entry of fs.readdirSync(candidateDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const runDir = path.join(candidateDir, entry.name);
      const reportPath = path.join(runDir, "report.json");
      const manifestPath = path.join(runDir, "run.json");
      if (!fs.existsSync(reportPath) || !fs.existsSync(manifestPath)) continue;
      const stat = fs.statSync(reportPath);
      if (stat.mtimeMs > bestMtime) {
        bestMtime = stat.mtimeMs;
        bestDir = runDir;
      }
    }
  }
  return bestDir;
}

function repoRelativePath(filePath: string): string {
  return path.relative(findRepoRoot(), filePath).replace(/\\/g, "/");
}

function rewriteDemoPathString(value: string, demoRunDir: string): string {
  const basename = path.basename(value);
  if (!demoArtifactBasenames.has(basename)) {
    return value;
  }

  const repoRelativeDemo = repoRelativePath(demoRunDir);
  const isSocialRunAbsolute = value.includes(`${path.sep}.runs${path.sep}social${path.sep}`);
  const isSocialRunRelative = value.startsWith("apps/llm/agents/.runs/social/");

  if (!isSocialRunAbsolute && !isSocialRunRelative) {
    return value;
  }

  return path.isAbsolute(value)
    ? path.join(demoRunDir, basename)
    : `${repoRelativeDemo}/${basename}`;
}

function rewriteDemoPathsDeep<T>(value: T, demoRunDir: string): T {
  if (typeof value === "string") {
    return rewriteDemoPathString(value, demoRunDir) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteDemoPathsDeep(item, demoRunDir)) as T;
  }
  if (value && typeof value === "object") {
    const next: LooseRecord = {};
    for (const [key, entry] of Object.entries(value as LooseRecord)) {
      next[key] = rewriteDemoPathsDeep(entry, demoRunDir);
    }
    return next as T;
  }
  return value;
}

function parseJsonlFile(filePath: string): SocialScreenRunEvent[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as SocialScreenRunEvent];
      } catch {
        return [];
      }
    });
}

function writeJsonlFile(filePath: string, events: SocialScreenRunEvent[]): void {
  const text = events.map((event) => JSON.stringify(event)).join("\n");
  fs.writeFileSync(filePath, text ? `${text}\n` : "", "utf-8");
}

function normalizeDemoBundle(demoRunDir: string): SocialScreenLatestPointer | null {
  const demoRunJson = path.join(demoRunDir, "run.json");
  const demoReportJson = path.join(demoRunDir, "report.json");
  const demoEventsJsonl = path.join(demoRunDir, "events.jsonl");

  const report = tryReadJson<LooseRecord>(demoReportJson);
  const manifest = tryReadJson<SocialScreenRunManifest>(demoRunJson);
  if (!manifest || !report) return null;

  const normalizedReport = rewriteDemoPathsDeep(report, demoRunDir);
  writeJsonAtomic(demoReportJson, normalizedReport);

  const evidencePacketPath = path.join(demoRunDir, "evidence_packet.json");
  const capturePath = path.join(demoRunDir, "capture.json");
  if (fs.existsSync(evidencePacketPath)) {
    const packet = tryReadJson<LooseRecord>(evidencePacketPath);
    if (packet) writeJsonAtomic(evidencePacketPath, rewriteDemoPathsDeep(packet, demoRunDir));
  }
  if (fs.existsSync(capturePath)) {
    const capture = tryReadJson<LooseRecord>(capturePath);
    if (capture) writeJsonAtomic(capturePath, rewriteDemoPathsDeep(capture, demoRunDir));
  }

  const sourceEvents = parseJsonlFile(demoEventsJsonl);
  const normalizedEvents = sourceEvents
    .filter((event) => event.type !== "log")
    .map((event, index) => ({
      ...rewriteDemoPathsDeep(event, demoRunDir),
      eventId: String(index + 1),
    }));
  writeJsonlFile(demoEventsJsonl, normalizedEvents);

  const candidateLabel =
    typeof normalizedReport.candidateLabel === "string" && normalizedReport.candidateLabel.trim()
      ? normalizedReport.candidateLabel.trim()
      : manifest.candidateLabel;
  const candidateId =
    typeof normalizedReport.candidateId === "string" && normalizedReport.candidateId.trim()
      ? normalizedReport.candidateId.trim()
      : manifest.candidateId;

  const nextManifest: SocialScreenRunManifest = {
    ...manifest,
    runId: "demo",
    candidateId,
    candidateLabel,
    candidateSlug: "demo",
    runDir: demoRunDir,
    status: "completed",
    finishedAtISO: manifest.finishedAtISO ?? nowIso(),
    stageStatus: {
      linkedin: normalizedReport.stageStatus && typeof normalizedReport.stageStatus === "object" && typeof (normalizedReport.stageStatus as LooseRecord).linkedin === "string"
        ? String((normalizedReport.stageStatus as LooseRecord).linkedin)
        : manifest.stageStatus.linkedin,
      github: normalizedReport.stageStatus && typeof normalizedReport.stageStatus === "object" && typeof (normalizedReport.stageStatus as LooseRecord).github === "string"
        ? String((normalizedReport.stageStatus as LooseRecord).github)
        : manifest.stageStatus.github,
      portfolio: normalizedReport.stageStatus && typeof normalizedReport.stageStatus === "object" && typeof (normalizedReport.stageStatus as LooseRecord).portfolio === "string"
        ? String((normalizedReport.stageStatus as LooseRecord).portfolio)
        : manifest.stageStatus.portfolio,
      web: normalizedReport.stageStatus && typeof normalizedReport.stageStatus === "object" && typeof (normalizedReport.stageStatus as LooseRecord).web === "string"
        ? String((normalizedReport.stageStatus as LooseRecord).web)
        : manifest.stageStatus.web,
    },
    paths: {
      runJson: demoRunJson,
      eventsJsonl: demoEventsJsonl,
      captureJson: fs.existsSync(capturePath) ? capturePath : undefined,
      evidencePacketJson: fs.existsSync(evidencePacketPath) ? evidencePacketPath : undefined,
      evidencePacketMarkdown: fs.existsSync(path.join(demoRunDir, "evidence_packet.md"))
        ? path.join(demoRunDir, "evidence_packet.md")
        : undefined,
      reportJson: demoReportJson,
    },
  };

  writeJsonAtomic(demoRunJson, nextManifest);
  runIndex.set("demo", demoRunJson);
  return {
    runId: "demo",
    runDir: demoRunDir,
    candidateSlug: "demo",
    candidateId,
    candidateLabel,
    startedAtISO: nextManifest.startedAtISO,
    updatedAtISO: nextManifest.updatedAtISO,
  };
}

function ensureDemoRun(): SocialScreenLatestPointer | null {
  const repoRoot = findRepoRoot();
  const demoBaseDir = path.join(repoRoot, "apps", "llm", "agents", ".runs", "social", "demo");
  const demoRunDir = path.join(demoBaseDir, "demo");
  const demoRunJson = path.join(demoRunDir, "run.json");
  const existing = tryReadJson<SocialScreenRunManifest>(demoRunJson);
  if (existing && fs.existsSync(path.join(demoRunDir, "report.json"))) {
    return normalizeDemoBundle(demoRunDir);
  }

  const sourceRunDir =
    findLatestSuccessfulRunDir("nguyen-phan-nguyen") ??
    findLatestSuccessfulRunDir();
  if (!sourceRunDir) return null;

  fs.mkdirSync(demoRunDir, { recursive: true });
  for (const fileName of [
    "capture.json",
    "evidence_packet.json",
    "evidence_packet.md",
    "nova_trace.txt",
    "nova_trace_raw.txt",
    "nova_return_block.txt",
    "report.json",
    "bedrock_input.txt",
    "replay.html",
    "events.jsonl",
  ]) {
    const source = path.join(sourceRunDir, fileName);
    if (fs.existsSync(source)) {
      fs.cpSync(source, path.join(demoRunDir, fileName), { recursive: true });
    }
  }

  const now = nowIso();
  const manifest: SocialScreenRunManifest = {
    runId: "demo",
    candidateId: "demo",
    candidateLabel: "Demo Candidate",
    candidateSlug: "demo",
    runDir: demoRunDir,
    status: "completed",
    startedAtISO: now,
    updatedAtISO: now,
    finishedAtISO: now,
    stageStatus: {
      linkedin: "partial",
      github: "partial",
      portfolio: "partial",
      web: "partial",
    },
    paths: {
      runJson: demoRunJson,
      eventsJsonl: path.join(demoRunDir, "events.jsonl"),
      captureJson: path.join(demoRunDir, "capture.json"),
      evidencePacketJson: path.join(demoRunDir, "evidence_packet.json"),
      evidencePacketMarkdown: path.join(demoRunDir, "evidence_packet.md"),
      reportJson: path.join(demoRunDir, "report.json"),
    },
    errors: [],
  };
  writeJsonAtomic(demoRunJson, manifest);
  runIndex.set("demo", demoRunJson);
  return normalizeDemoBundle(demoRunDir);
}

function scanLatestRunPointer(candidate?: string): SocialScreenLatestPointer | null {
  const repoRoot = findRepoRoot();
  const baseDir = path.join(repoRoot, "apps", "llm", "agents", ".runs", "social");
  const candidateSlug = candidate?.trim();

  const candidateDirs = candidateSlug
    ? [path.join(baseDir, candidateSlug)]
    : fs.existsSync(baseDir)
      ? fs
          .readdirSync(baseDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(baseDir, entry.name))
      : [];

  let best: { manifest: SocialScreenRunManifest; mtimeMs: number } | null = null;

  for (const candidateDir of candidateDirs) {
    if (!fs.existsSync(candidateDir)) continue;
    for (const entry of fs.readdirSync(candidateDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const runJsonPath = path.join(candidateDir, entry.name, "run.json");
      if (!fs.existsSync(runJsonPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(runJsonPath, "utf-8")) as SocialScreenRunManifest;
        const stat = fs.statSync(runJsonPath);
        if (!best || stat.mtimeMs > best.mtimeMs) {
          best = { manifest, mtimeMs: stat.mtimeMs };
        }
      } catch {
        // ignore malformed manifests
      }
    }
  }

  if (!best) return null;

  const pointer: SocialScreenLatestPointer = {
    runId: best.manifest.runId,
    runDir: best.manifest.runDir,
    candidateSlug: best.manifest.candidateSlug,
    candidateId: best.manifest.candidateId,
    candidateLabel: best.manifest.candidateLabel,
    startedAtISO: best.manifest.startedAtISO,
    updatedAtISO: best.manifest.updatedAtISO,
  };

  return pointer;
}

export function resolveSocialScreenRunId(
  runIdOrAlias: string,
  candidate?: string,
): string | null {
  const normalized = runIdOrAlias.trim();
  if (!normalized) return null;
  if (normalized === "demo") return ensureDemoRun()?.runId ?? null;
  if (normalized !== "latest") return normalized;
  return readLatestPointer(candidate)?.runId ?? scanLatestRunPointer(candidate)?.runId ?? null;
}

export function getSocialScreenRunManifest(
  runId: string,
): SocialScreenRunManifest | null {
  const direct = runIndex.get(runId);
  if (direct && fs.existsSync(direct)) {
    return JSON.parse(fs.readFileSync(direct, "utf-8")) as SocialScreenRunManifest;
  }

  const repoRoot = findRepoRoot();
  const baseDir = path.join(repoRoot, "apps", "llm", "agents", ".runs", "social");
  if (!fs.existsSync(baseDir)) return null;

  for (const candidateEntry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!candidateEntry.isDirectory()) continue;
    const runJsonPath = path.join(baseDir, candidateEntry.name, runId, "run.json");
    if (fs.existsSync(runJsonPath)) {
      runIndex.set(runId, runJsonPath);
      return JSON.parse(fs.readFileSync(runJsonPath, "utf-8")) as SocialScreenRunManifest;
    }
  }

  return null;
}

export function updateSocialScreenRunManifest(
  runId: string,
  updater: (manifest: SocialScreenRunManifest) => SocialScreenRunManifest | void,
): SocialScreenRunManifest | null {
  const existing = getSocialScreenRunManifest(runId);
  if (!existing) return null;

  const clone: SocialScreenRunManifest = JSON.parse(JSON.stringify(existing));
  const updated = updater(clone) ?? clone;
  return writeSocialScreenRunManifest(updated);
}

export function appendSocialScreenRunEvent(
  runId: string,
  event: SocialScreenRunEventDraft,
): SocialScreenRunEvent {
  const manifest = getSocialScreenRunManifest(runId);
  if (!manifest) {
    throw new Error(`Run manifest not found for runId: ${runId}`);
  }

  const existing = fs.existsSync(manifest.paths.eventsJsonl)
    ? fs
        .readFileSync(manifest.paths.eventsJsonl, "utf-8")
        .split("\n")
        .filter((line) => line.trim()).length
    : 0;

  const nextEvent = {
    ...event,
    eventId: String(existing + 1),
    timestampISO: event.timestampISO ?? nowIso(),
  } as SocialScreenRunEvent;

  fs.appendFileSync(manifest.paths.eventsJsonl, `${JSON.stringify(nextEvent)}\n`, "utf-8");
  updateSocialScreenRunManifest(runId, (next) => next);
  return nextEvent;
}

export function readSocialScreenRunEvents(runId: string): SocialScreenRunEvent[] {
  const manifest = getSocialScreenRunManifest(runId);
  if (!manifest || !fs.existsSync(manifest.paths.eventsJsonl)) {
    return [];
  }

  return fs
    .readFileSync(manifest.paths.eventsJsonl, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as SocialScreenRunEvent];
      } catch {
        return [];
      }
    });
}

export function loadSocialScreenRunReport(runId: string): unknown | null {
  const manifest = getSocialScreenRunManifest(runId);
  if (!manifest?.paths.reportJson || !fileExists(manifest.paths.reportJson)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifest.paths.reportJson, "utf-8")) as unknown;
}

export function resolveSocialScreenRunAlias(
  runIdOrAlias: string,
  candidate?: string,
): { runId: string | null; error?: string; candidate?: string } {
  const normalized = runIdOrAlias.trim();
  if (!normalized) return { runId: null, error: "Missing required query param: runId", candidate };
  if (normalized === "latest") {
    const runId = resolveSocialScreenRunId(normalized, candidate);
    return runId
      ? { runId }
      : { runId: null, error: "No latest run", candidate };
  }
  if (normalized === "demo") {
    const runId = resolveSocialScreenRunId(normalized, candidate);
    return runId
      ? { runId }
      : { runId: null, error: "No demo run available", candidate };
  }
  return { runId: normalized };
}

export function getSocialScreenRunStatus(runId: string): {
  runId: string;
  status: SocialScreenRunStatus;
  updatedAtISO: string;
  startedAtISO: string;
  finishedAtISO?: string;
  runDir: string;
  stageStatus: SocialScreenRunManifest["stageStatus"];
} | null {
  const manifest = getSocialScreenRunManifest(runId);
  if (!manifest) return null;
  return {
    runId: manifest.runId,
    status: manifest.status,
    updatedAtISO: manifest.updatedAtISO,
    startedAtISO: manifest.startedAtISO,
    finishedAtISO: manifest.finishedAtISO,
    runDir: manifest.runDir,
    stageStatus: manifest.stageStatus,
  };
}
