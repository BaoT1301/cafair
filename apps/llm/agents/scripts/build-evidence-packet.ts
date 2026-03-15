import fs from "node:fs";
import path from "node:path";
import { writeSocialEvidencePacket } from "../src/services/evidencePacketBuilder.js";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function resolveLatestRunDir(candidate: string): string {
  const baseDir = path.resolve(
    process.cwd(),
    "apps/llm/agents/.runs/social",
    candidate,
  );

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Candidate run directory does not exist: ${baseDir}`);
  }

  const candidates = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(baseDir, entry.name))
    .sort();

  const latest = candidates.at(-1);
  if (!latest) {
    throw new Error(`No run directories found for candidate: ${candidate}`);
  }

  return latest;
}

function main(): number {
  const runDirArg = readArg("--run-dir");
  const latest = hasFlag("--latest");
  const candidate = readArg("--candidate");
  const pretty = hasFlag("--pretty");

  let runDir: string;
  if (runDirArg) {
    runDir = path.resolve(process.cwd(), runDirArg);
  } else if (latest) {
    if (!candidate) {
      throw new Error("--candidate is required when using --latest.");
    }
    runDir = resolveLatestRunDir(candidate);
  } else {
    throw new Error("Pass either --run-dir <path> or --latest --candidate <slug>.");
  }

  const { packet, evidencePacketPath, evidencePacketMarkdownPath } =
    writeSocialEvidencePacket({ runDir });

  const payload = {
    runDir,
    evidencePacketPath,
    evidencePacketMarkdownPath,
    packet,
  };

  process.stdout.write(
    `${JSON.stringify(payload, null, pretty ? 2 : undefined)}\n`,
  );

  return 0;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
