import { describe, expect, it } from "vitest";
import { parseJsonlText } from "./socialRunValidator.js";

describe("social run validator", () => {
  it("parses valid jsonl with trailing newline", () => {
    const text = [
      JSON.stringify({ type: "status", message: "ok" }),
      JSON.stringify({ type: "finding", message: "claim" }),
      "",
    ].join("\n");

    const result = parseJsonlText(text);
    expect(result.events).toHaveLength(2);
    expect(result.parseErrors).toHaveLength(0);
  });

  it("continues past malformed jsonl lines", () => {
    const text = [
      JSON.stringify({ type: "status", message: "ok" }),
      '{"bad": }',
      JSON.stringify({ type: "done", message: "done" }),
    ].join("\n");

    const result = parseJsonlText(text);
    expect(result.events).toHaveLength(2);
    expect(result.parseErrors).toHaveLength(1);
    expect(result.parseErrors[0]?.line).toBe(2);
  });

  it("flags accidental sse lines as parse errors without crashing", () => {
    const text = [
      "id: 12",
      "event: status",
      'data: {"type":"status"}',
      JSON.stringify({ type: "done", message: "done" }),
    ].join("\n");

    const result = parseJsonlText(text);
    expect(result.events).toHaveLength(1);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });
});
