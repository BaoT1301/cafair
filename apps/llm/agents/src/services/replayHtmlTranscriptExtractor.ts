type TranscriptSource = "replay_html" | "logs_dir" | "none";

type LogCandidate = {
  name: string;
  content: string;
};

type ExtractionResult = {
  source: TranscriptSource;
  text: string | null;
  matchedFiles: string[];
};

const TRACE_LINE_RE =
  /((?:think|agentClick|agentType|agentScroll|goToUrl|return)\([\s\S]*?\);|BEGIN_CAPTURE_JSON|END_CAPTURE_JSON)/g;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_match, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 16)),
    )
    .replace(/&#(\d+);/g, (_match, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 10)),
    );
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    output.push(line);
  }
  return output;
}

function extractStructuredLines(text: string): string[] {
  const lines: string[] = [];
  const decodedVariants = [
    text,
    decodeHtmlEntities(text),
    decodeHtmlEntities(text).replace(/\\n/g, "\n").replace(/\\"/g, "\""),
  ];

  for (const variant of decodedVariants) {
    for (const match of variant.matchAll(TRACE_LINE_RE)) {
      const value = match[0]?.trim();
      if (value) {
        lines.push(value);
      }
    }

    const preBlocks = [...variant.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)].map((match) =>
      decodeHtmlEntities(match[1] ?? "").replace(/<[^>]+>/g, ""),
    );
    for (const block of preBlocks) {
      for (const blockLine of normalizeLines(block)) {
        if (/(think\(|agentClick\(|agentType\(|agentScroll\(|goToUrl\(|return\(|BEGIN_CAPTURE_JSON|END_CAPTURE_JSON)/.test(blockLine)) {
          lines.push(blockLine);
        }
      }
    }
  }

  return dedupe(lines);
}

export function extractTranscriptFromReplayHtml(htmlText: string): string | null {
  const lines = extractStructuredLines(htmlText);
  return lines.length ? `${lines.join("\n")}\n` : null;
}

export function extractTranscriptFromLogsDir(
  files: LogCandidate[],
): ExtractionResult {
  const matchedFiles: string[] = [];
  const lines: string[] = [];
  let source: TranscriptSource = "none";

  for (const file of files) {
    const extracted = extractStructuredLines(file.content);
    if (!extracted.length) {
      continue;
    }
    matchedFiles.push(file.name);
    lines.push(...extracted);
    if (file.name.endsWith(".html")) {
      source = "replay_html";
    } else if (source === "none") {
      source = "logs_dir";
    }
  }

  const deduped = dedupe(lines);
  return {
    source,
    text: deduped.length ? `${deduped.join("\n")}\n` : null,
    matchedFiles,
  };
}

