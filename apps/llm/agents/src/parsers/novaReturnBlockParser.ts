type LooseRecord = Record<string, unknown>;

export type ParsedReturnBlock = {
  payload: LooseRecord | null;
  warnings: string[];
};

function extractJsonBlock(text: string): string | null {
  const match = text.match(/BEGIN_CAPTURE_JSON\s*([\s\S]*?)\s*END_CAPTURE_JSON/i);
  if (!match) {
    return null;
  }

  return match[1]?.trim() || null;
}

function extractFirstJsonObject(text: string): LooseRecord | null {
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = text.slice(start, index + 1);
        try {
          const parsed = JSON.parse(candidate) as unknown;
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as LooseRecord)
            : null;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

export function parseNovaReturnBlock(text: string | null | undefined): ParsedReturnBlock {
  const warnings: string[] = [];

  if (!text || !text.trim()) {
    return {
      payload: null,
      warnings: ["Return block file is empty."],
    };
  }

  const fromSentinel = extractJsonBlock(text);
  if (fromSentinel) {
    try {
      const parsed = JSON.parse(fromSentinel) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          payload: parsed as LooseRecord,
          warnings,
        };
      }
      warnings.push("Return block JSON did not parse into an object.");
    } catch (error) {
      warnings.push(
        `Failed to parse JSON between BEGIN_CAPTURE_JSON and END_CAPTURE_JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  } else {
    warnings.push("Return block sentinels were not found.");
  }

  const fallback = extractFirstJsonObject(text);
  if (fallback) {
    warnings.push("Used fallback JSON-object extraction for return block.");
    return {
      payload: fallback,
      warnings,
    };
  }

  warnings.push("No JSON object could be extracted from return block.");
  return {
    payload: null,
    warnings,
  };
}
