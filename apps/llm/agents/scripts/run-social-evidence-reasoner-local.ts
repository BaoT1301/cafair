import fs from "node:fs";
import path from "node:path";
import { runBedrockSocialEvidenceReasoner } from "../src/agents/socialEvidenceReasoner.js";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseBooleanFlag(flag: string, defaultValue: boolean): boolean {
  const value = readArg(flag);
  if (!value) return defaultValue;
  return !["0", "false", "FALSE", "off", "no"].includes(value);
}

function resolveEvidencePacketPath(runDir: string): string {
  const evidencePacketPath = path.join(runDir, "evidence_packet.json");
  if (!fs.existsSync(evidencePacketPath)) {
    throw new Error(`evidence_packet.json not found in run dir: ${runDir}`);
  }
  return evidencePacketPath;
}

function writeJsonAtomic(filePath: string, payload: unknown): void {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, serialized, "utf-8");
  JSON.parse(fs.readFileSync(tmpPath, "utf-8"));
  fs.renameSync(tmpPath, filePath);
}

async function main(): Promise<number> {
  const runDirArg = readArg("--run-dir");
  const evidencePacketPathArg = readArg("--evidence-packet-path");
  const candidateId = readArg("--candidate-id");
  const roleTitle = readArg("--role-title");
  const companyName = readArg("--company-name");
  const outFileArg = readArg("--out-file");
  const pretty = hasFlag("--pretty");
  const jsonOnly = hasFlag("--json-only");
  const printMetricsToStderr = parseBooleanFlag("--print-metrics-to-stderr", true);

  if (!runDirArg && !evidencePacketPathArg) {
    throw new Error("Pass either --run-dir <path> or --evidence-packet-path <path>.");
  }

  const evidencePacketPath = evidencePacketPathArg
    ? path.resolve(process.cwd(), evidencePacketPathArg)
    : resolveEvidencePacketPath(path.resolve(process.cwd(), runDirArg!));

  const result = await runBedrockSocialEvidenceReasoner({
    evidencePacketPath,
    candidateId,
    roleTitle,
    companyName,
  });

  if (outFileArg) {
    writeJsonAtomic(path.resolve(process.cwd(), outFileArg), result);
  }

  if (!jsonOnly && printMetricsToStderr && result.metrics) {
    process.stderr.write(
      `${JSON.stringify({
        type: "bedrock_metrics",
        ...result.metrics,
        provider: result.provider,
        modelId: result.modelId,
      })}\n`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(result, null, pretty ? 2 : undefined)}\n`,
  );

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
