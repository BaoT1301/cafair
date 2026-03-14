import path from "node:path";
import { validateSocialRunDir } from "../src/services/socialRunValidator.js";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function main(): number {
  const runDirArg = readArg("--run-dir");
  if (!runDirArg) {
    throw new Error("Pass --run-dir <path>.");
  }

  const runDir = path.resolve(process.cwd(), runDirArg);
  const checks = validateSocialRunDir(runDir);
  const failed = checks.filter((check) => !check.ok);

  for (const check of checks) {
    process.stdout.write(`${check.ok ? "OK" : "FAIL"}  ${check.file}  ${check.detail}\n`);
  }

  return failed.length === 0 ? 0 : 1;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
