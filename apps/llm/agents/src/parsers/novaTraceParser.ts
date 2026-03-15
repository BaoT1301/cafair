const THINK_RE = /think\("([\s\S]*?)"\);?/g;
const ACTION_PATTERNS = {
  agentClick: /agentClick\(([\s\S]*?)\);?/g,
  agentType: /agentType\(([\s\S]*?)\);?/g,
  agentScroll: /agentScroll\(([\s\S]*?)\);?/g,
  goToUrl: /goToUrl\("([^"]+)"\);?/g,
} as const;

export type TraceTimelineItem = {
  t?: string;
  kind: "think" | "action" | "return";
  text: string;
  lineRef?: string;
};

export type TraceEvidenceCandidate = {
  snippet: string;
  lineRef: string;
  stage?: string;
};

export type ParsedNovaTrace = {
  thinkCount: number;
  returnCount: number;
  actionCounts: {
    agentClick: number;
    agentType: number;
    agentScroll: number;
    goToUrl: number;
  };
  timeline: TraceTimelineItem[];
  actedUrls: string[];
  evidenceCandidates: TraceEvidenceCandidate[];
  warnings: string[];
};

function truncate(text: string, limit = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}

function normalizeMultilineCapture(text: string): string {
  return text
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTimeline(text: string): TraceTimelineItem[] {
  const entries: Array<TraceTimelineItem & { offset: number }> = [];

  for (const match of text.matchAll(THINK_RE)) {
    entries.push({
      offset: match.index ?? 0,
      kind: "think",
      text: truncate(normalizeMultilineCapture(match[1] ?? "")),
    });
  }

  for (const [actionName, pattern] of Object.entries(ACTION_PATTERNS)) {
    for (const match of text.matchAll(pattern)) {
      const payload = normalizeMultilineCapture(match[1] ?? "");
      const textValue =
        actionName === "goToUrl"
          ? `${actionName}: ${payload}`
          : `${actionName}: ${truncate(payload, 220)}`;
      entries.push({
        offset: match.index ?? 0,
        kind: "action",
        text: truncate(textValue),
      });
    }
  }

  const returnRegex = /return\("([\s\S]*?)"\);?/g;
  for (const match of text.matchAll(returnRegex)) {
    entries.push({
      offset: match.index ?? 0,
      kind: "return",
      text: truncate(normalizeMultilineCapture(match[1] ?? "")),
    });
  }

  entries.sort((left, right) => left.offset - right.offset);

  if (entries.length <= 200) {
    return entries.map(({ offset: _offset, ...entry }) => entry);
  }

  const first = entries.slice(0, 150);
  const remaining = entries.slice(150);
  const stride = Math.max(1, Math.floor(remaining.length / 50));
  const sampled = remaining.filter((_entry, index) => index % stride === 0).slice(0, 50);
  return [...first, ...sampled].map(({ offset: _offset, ...entry }) => entry);
}

function extractEvidenceCandidates(text: string): TraceEvidenceCandidate[] {
  const candidates: TraceEvidenceCandidate[] = [];
  let currentStage = "unknown";
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const stageMatch = line.match(/===== STAGE:\s*([a-z0-9_-]+)\s*=====/i);
    if (stageMatch) {
      currentStage = stageMatch[1].toLowerCase();
      continue;
    }

    const interesting =
      /think\("/i.test(line) &&
      /(i see|visible|headline|current role|current company|company|school|education|followers|following|contributions|pinned|repo|project|owner name|portfolio owner|mismatch|github|resume|retro)/i.test(
        line,
      );

    if (!interesting) {
      continue;
    }

    candidates.push({
      stage: currentStage,
      lineRef: `${currentStage}:${index + 1}`,
      snippet: truncate(normalizeMultilineCapture(line), 280),
    });
  }

  return candidates;
}

export function parseNovaTrace(text: string | null | undefined): ParsedNovaTrace {
  const normalized = text ?? "";
  const actionCounts = {
    agentClick: [...normalized.matchAll(ACTION_PATTERNS.agentClick)].length,
    agentType: [...normalized.matchAll(ACTION_PATTERNS.agentType)].length,
    agentScroll: [...normalized.matchAll(ACTION_PATTERNS.agentScroll)].length,
    goToUrl: [...normalized.matchAll(ACTION_PATTERNS.goToUrl)].length,
  };

  const actedUrls = [
    ...new Set(
      [
        ...[...normalized.matchAll(ACTION_PATTERNS.goToUrl)].map((match) => match[1]),
        ...[...normalized.matchAll(/https?:\/\/[^\s)"']+/g)].map((match) => match[0]),
      ].filter(Boolean),
    ),
  ];

  return {
    thinkCount: [...normalized.matchAll(THINK_RE)].length,
    returnCount: [...normalized.matchAll(/return\("([\s\S]*?)"\);?/g)].length,
    actionCounts,
    timeline: buildTimeline(normalized),
    actedUrls,
    evidenceCandidates: extractEvidenceCandidates(normalized),
    warnings: normalized.trim()
      ? []
      : ["Trace file is empty."],
  };
}
