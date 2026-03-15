import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { ApplyAgentPythonResponse } from "../../src/apply-agent/contracts";

type RunnerTransport = "workflow" | "api" | "auto";
type RunnerMode = "plan" | "demo" | "live";
type ApplicationProvider = "greenhouse" | "workday" | "ashby" | "unknown";

type ApplyAgentPythonPayload = {
  runId: string;
  targetUrl: string;
  provider: ApplicationProvider;
  mode: RunnerMode;
  transport: RunnerTransport;
  shouldApply: boolean;
  safeStopBeforeSubmit: boolean;
  company: string | null;
  roleTitle: string | null;
  selectors: string[];
  plannedSteps: string[];
};

const scriptPath = resolve(
  process.cwd(),
  "apps/llm/agents/scripts/apply-agent/run-nova.py",
);

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function readBooleanArg(flag: string, defaultValue: boolean): boolean {
  const value = readArg(flag);
  if (!value) return defaultValue;

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;

  return defaultValue;
}

function readTransportArg(): RunnerTransport {
  const value = readArg("--transport")?.trim().toLowerCase();

  if (value === "workflow") return "workflow";
  if (value === "api") return "api";
  if (value === "auto") return "auto";

  return "auto";
}

function readModeArg(): RunnerMode {
  const value = readArg("--mode")?.trim().toLowerCase();

  if (value === "plan") return "plan";
  if (value === "demo") return "demo";
  if (value === "live") return "live";

  return "plan";
}

function readProviderArg(): ApplicationProvider {
  const value = readArg("--provider")?.trim().toLowerCase();

  if (value === "greenhouse") return "greenhouse";
  if (value === "workday") return "workday";
  if (value === "ashby") return "ashby";

  return "unknown";
}

function readStringArg(flag: string, fallback: string): string {
  const value = readArg(flag);
  if (!value) return fallback;

  const trimmed = value.trim();
  return trimmed || fallback;
}

function buildSelectors(provider: ApplicationProvider): string[] {
  if (provider === "greenhouse") {
    return [
      "a[href*='application']",
      "button",
      "form",
      "input",
      "textarea",
      "input[type='file']",
    ];
  }

  if (provider === "workday") {
    return [
      "a[data-automation-id='applyManually']",
      "button[data-automation-id='applyManually']",
      "button",
      "form",
      "input",
      "textarea",
      "input[type='file']",
    ];
  }

  if (provider === "ashby") {
    return [
      "form",
      "button",
      "input",
      "textarea",
      "input[type='file']",
    ];
  }

  return ["button", "form", "input", "textarea", "input[type='file']"];
}

function buildPlannedSteps(args: {
  provider: ApplicationProvider;
  roleTitle: string | null;
  company: string | null;
  shouldApply: boolean;
  mode: RunnerMode;
}): string[] {
  const role = args.roleTitle || "target role";
  const company = args.company || "target company";

  const steps: string[] = [
    `Open the job page for ${role} at ${company}.`,
    "Wait for the page to stabilize.",
    "Verify the application page is reachable.",
  ];

  if (!args.shouldApply) {
    steps.push(
      "Stop because this role did not meet the apply threshold.",
      "Return a skip recommendation.",
    );
    return steps;
  }

  if (args.provider === "greenhouse") {
    steps.push(
      "Find the Greenhouse Apply button.",
      "Open the application form.",
      "Capture visible applicant fields.",
    );
  } else if (args.provider === "workday") {
    steps.push(
      "Find the Workday Apply button.",
      "Handle guest apply or sign-in branch.",
      "Capture visible applicant fields.",
    );
  } else if (args.provider === "ashby") {
    steps.push(
      "Find the Ashby application form.",
      "Capture visible applicant fields.",
    );
  } else {
    steps.push(
      "Find the primary Apply entry point.",
      "Capture visible applicant fields.",
    );
  }

  if (args.mode === "plan") {
    steps.push("Return plan only without launching live browser automation.");
    return steps;
  }

  if (args.mode === "demo") {
    steps.push(
      "Simulate prefilling saved candidate data.",
      "Stop before final submit.",
    );
    return steps;
  }

  steps.push(
    "Launch live browser automation.",
    "Prefill saved candidate data.",
    "Stop before final submit unless safe stop is disabled.",
  );

  return steps;
}

function buildPayload(): ApplyAgentPythonPayload {
  const provider = readProviderArg();
  const mode = readModeArg();
  const transport = readTransportArg();

  const targetUrl = readStringArg(
    "--url",
    "https://job-boards.greenhouse.io/fspco-op012325/jobs/8433215002",
  );

  const company = readArg("--company")?.trim() || "Flagship Pioneering";
  const roleTitle =
    readArg("--role")?.trim() || "IT Automation Engineering Intern";

  const shouldApply = readBooleanArg("--should-apply", true);
  const safeStopBeforeSubmit = readBooleanArg("--safe-stop", true);

  const selectors = buildSelectors(provider);
  const plannedSteps = buildPlannedSteps({
    provider,
    roleTitle,
    company,
    shouldApply,
    mode,
  });

  return {
    runId: `aar_local_${Date.now()}`,
    targetUrl,
    provider,
    mode,
    transport,
    shouldApply,
    safeStopBeforeSubmit,
    company,
    roleTitle,
    selectors,
    plannedSteps,
  };
}

async function run(): Promise<void> {
  const payload = buildPayload();

  const child = spawn("python3", [scriptPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();

  const exitCode: number = await new Promise((resolveExit) => {
    child.on("close", (code) => {
      resolveExit(code ?? 1);
    });
  });

  if (exitCode !== 0) {
    console.error("Python runner failed.");

    if (stderr.trim()) {
      console.error(stderr.trim());
    }

    process.exit(exitCode);
  }

  if (!stdout.trim()) {
    console.error("Python runner returned empty output.");
    process.exit(1);
  }

  const parsed = JSON.parse(stdout) as ApplyAgentPythonResponse;
  console.log(JSON.stringify(parsed, null, 2));
}

run().catch((error) => {
  console.error("Failed to run local apply-agent bridge:", error);
  process.exit(1);
});