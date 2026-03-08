// Path: apps/llm/agents/src/services/socialCaptureLocal.ts

import { spawnSync } from "node:child_process";
import path from "node:path";

export interface SocialCaptureLocalInput {
  candidateId: string;
  name: string;
  linkedin?: string;
  github?: string;
  webQueries?: string[];
  timeoutSeconds?: number;
  pollIntervalSeconds?: number;
  localBrowser?: boolean;
  manualLinkedinLogin?: boolean;
  debugLogs?: boolean;
  preferChrome?: boolean;
}

export interface SocialCaptureBatchInput {
  candidates: SocialCaptureLocalInput[];
  timeoutSeconds?: number;
  pollIntervalSeconds?: number;
  localBrowser?: boolean;
  manualLinkedinLogin?: boolean;
  debugLogs?: boolean;
  preferChrome?: boolean;
}

export interface SocialCaptureLocalSuccess {
  ok: true;
  result: unknown;
  stdout: string;
  stderr?: string;
}

export interface SocialCaptureLocalFailure {
  ok: false;
  error: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
}

export type SocialCaptureLocalResponse =
  | SocialCaptureLocalSuccess
  | SocialCaptureLocalFailure;

function getAgentsRoot(): string {
  // Assumes this file lives in apps/llm/agents/src/services
  return path.resolve(process.cwd(), "apps/llm/agents");
}

function getPythonCommand(): string {
  return process.env.PYTHON_BIN?.trim() || "python";
}

function safeParseJson(text: string): unknown {
  return JSON.parse(text);
}

export function runSocialCaptureLocal(
  input: SocialCaptureLocalInput,
): SocialCaptureLocalResponse {
  const agentsRoot = getAgentsRoot();
  const scriptPath = path.join(agentsRoot, "scripts", "run-social-capture-nova.py");

  const args: string[] = [scriptPath, input.name];

  if (input.linkedin) args.push("--linkedin", input.linkedin);
  if (input.github) args.push("--github", input.github);

  for (const q of input.webQueries ?? []) {
    if (q?.trim()) args.push("--web-query", q.trim());
  }

  args.push(
    "--timeout-seconds",
    String(input.timeoutSeconds ?? 180),
    "--poll-interval-seconds",
    String(input.pollIntervalSeconds ?? 3),
  );

  if (input.localBrowser) args.push("--local-browser");
  if (input.manualLinkedinLogin) args.push("--manual-linkedin-login");
  if (input.debugLogs) args.push("--debug-logs");
  if (input.preferChrome) args.push("--prefer-chrome");

  const result = spawnSync(getPythonCommand(), args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf-8",
  });

  const stdout = (result.stdout ?? "").trim();
  const stderr = (result.stderr ?? "").trim();

  if (result.status !== 0) {
    return {
      ok: false,
      error: `run-social-capture-nova.py failed`,
      stdout,
      stderr,
      exitCode: result.status,
    };
  }

  try {
    const parsed = safeParseJson(stdout);
    return {
      ok: true,
      result: parsed,
      stdout,
      stderr: stderr || undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Failed to parse social capture JSON: ${error.message}`
          : "Failed to parse social capture JSON",
      stdout,
      stderr,
      exitCode: result.status,
    };
  }
}

export function runSocialCaptureBatchLocal(
  input: SocialCaptureBatchInput,
): SocialCaptureLocalResponse {
  const agentsRoot = getAgentsRoot();
  const scriptPath = path.join(agentsRoot, "scripts", "run-social-capture-batch.py");

  // Pass batch via temp JSON file
  const tempFilePath = path.join(
    agentsRoot,
    "scripts",
    `tmp-social-capture-batch-${Date.now()}.json`,
  );

  const fs = require("node:fs") as typeof import("node:fs");

  try {
    fs.writeFileSync(
      tempFilePath,
      JSON.stringify(
        input.candidates.map((c) => ({
          candidateId: c.candidateId,
          name: c.name,
          linkedin: c.linkedin,
          github: c.github,
          webQueries: c.webQueries ?? [],
        })),
        null,
        2,
      ),
      "utf-8",
    );

    const args: string[] = [
      scriptPath,
      "--input",
      tempFilePath,
      "--timeout-seconds",
      String(input.timeoutSeconds ?? 180),
      "--poll-interval-seconds",
      String(input.pollIntervalSeconds ?? 3),
    ];

    if (input.localBrowser) args.push("--local-browser");
    if (input.manualLinkedinLogin) args.push("--manual-linkedin-login");
    if (input.debugLogs) args.push("--debug-logs");
    if (input.preferChrome) args.push("--prefer-chrome");

    const result = spawnSync(getPythonCommand(), args, {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf-8",
    });

    const stdout = (result.stdout ?? "").trim();
    const stderr = (result.stderr ?? "").trim();

    if (result.status !== 0) {
      return {
        ok: false,
        error: "run-social-capture-batch.py failed",
        stdout,
        stderr,
        exitCode: result.status,
      };
    }

    try {
      const parsed = safeParseJson(stdout);
      return {
        ok: true,
        result: parsed,
        stdout,
        stderr: stderr || undefined,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `Failed to parse batch social capture JSON: ${error.message}`
            : "Failed to parse batch social capture JSON",
        stdout,
        stderr,
        exitCode: result.status,
      };
    }
  } finally {
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // ignore
    }
  }
}