import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractTranscriptFromLogsDir,
  extractTranscriptFromReplayHtml,
} from "./replayHtmlTranscriptExtractor.js";

function fixturePath(name: string): string {
  return path.resolve(__dirname, "__fixtures__", name);
}

describe("replayHtmlTranscriptExtractor", () => {
  it("extracts think and action lines from replay html", () => {
    const html = fs.readFileSync(fixturePath("minimal-replay.html"), "utf-8");
    const transcript = extractTranscriptFromReplayHtml(html);

    expect(transcript).toContain('think("I see the visible headline is Data Scientist.");');
    expect(transcript).toContain('agentClick("<box>10,10,80,40</box>");');
    expect(transcript).toContain("BEGIN_CAPTURE_JSON");
  });

  it("prefers replay_html over logs_dir when html transcript exists", () => {
    const html = fs.readFileSync(fixturePath("minimal-replay.html"), "utf-8");
    const jsonl = fs.readFileSync(fixturePath("minimal-events.jsonl"), "utf-8");

    const result = extractTranscriptFromLogsDir([
      { name: "act_demo.html", content: html },
      { name: "events.jsonl", content: jsonl },
    ]);

    expect(result.source).toBe("replay_html");
    expect(result.text).toContain("think(");
    expect(result.text).toContain("agentClick(");
    expect(result.matchedFiles).toContain("act_demo.html");
  });

  it("uses logs_dir when only jsonl transcript exists", () => {
    const jsonl = fs.readFileSync(fixturePath("minimal-events.jsonl"), "utf-8");

    const result = extractTranscriptFromLogsDir([
      { name: "events.jsonl", content: jsonl },
    ]);

    expect(result.source).toBe("logs_dir");
    expect(result.text).toContain("think(");
    expect(result.text).toContain("goToUrl(");
  });
});

