import fs from "node:fs";
import path from "node:path";

export type JsonlParseError = {
  line: number;
  message: string;
  excerpt: string;
};

export function describeJsonParseFailure(text: string, error: unknown): string {
  if (!(error instanceof SyntaxError) || typeof (error as SyntaxError & { pos?: number }).pos !== "number") {
    return error instanceof Error ? error.message : String(error);
  }
  const pos = (error as SyntaxError & { pos: number }).pos;
  const start = Math.max(0, pos - 120);
  const end = Math.min(text.length, pos + 120);
  return `${error.message} near: ${text.slice(start, end).replace(/\s+/g, " ")}`;
}

export function parseJsonlText(text: string): {
  events: Array<Record<string, unknown>>;
  parseErrors: JsonlParseError[];
} {
  const events: Array<Record<string, unknown>> = [];
  const parseErrors: JsonlParseError[] = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        events.push(parsed as Record<string, unknown>);
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

export function validateJsonFile(
  filePath: string,
): { ok: true; size: number } | { ok: false; size: number; error: string } {
  const text = fs.readFileSync(filePath, "utf-8");
  try {
    JSON.parse(text);
    return { ok: true, size: text.length };
  } catch (error) {
    return {
      ok: false,
      size: text.length,
      error: describeJsonParseFailure(text, error),
    };
  }
}

export function validateSocialRunDir(runDir: string): Array<{
  file: string;
  ok: boolean;
  detail: string;
}> {
  const checks: Array<{ file: string; ok: boolean; detail: string }> = [];
  const files = [
    "capture.json",
    "evidence_packet.json",
    "report.json",
  ];

  for (const fileName of files) {
    const fullPath = path.join(runDir, fileName);
    if (!fs.existsSync(fullPath)) {
      checks.push({ file: fileName, ok: false, detail: "missing" });
      continue;
    }
    const result = validateJsonFile(fullPath);
    checks.push({
      file: fileName,
      ok: result.ok,
      detail: result.ok ? `ok (${result.size} bytes)` : result.error,
    });
  }

  const eventsPath = path.join(runDir, "events.jsonl");
  if (!fs.existsSync(eventsPath)) {
    checks.push({ file: "events.jsonl", ok: false, detail: "missing" });
  } else {
    const text = fs.readFileSync(eventsPath, "utf-8");
    const parsed = parseJsonlText(text);
    checks.push({
      file: "events.jsonl",
      ok: parsed.parseErrors.length === 0,
      detail:
        parsed.parseErrors.length === 0
          ? `ok (${parsed.events.length} events)`
          : `parse errors: ${parsed.parseErrors
              .map((error) => `line ${error.line}: ${error.message} [${error.excerpt}]`)
              .join("; ")}`,
    });
  }

  return checks;
}
