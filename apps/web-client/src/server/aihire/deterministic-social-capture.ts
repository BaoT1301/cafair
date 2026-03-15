import fs from "node:fs";
import path from "node:path";

type StageName = "linkedin" | "github" | "portfolio" | "web";
type FindingSeverity = "info" | "warning" | "critical";
type CitationSource = "linkedin" | "github" | "portfolio" | "web" | "system";

export interface DeterministicSocialCaptureInput {
  runDir: string;
  candidateId?: string;
  candidateLabel: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  webQueries?: string[];
}

export interface DeterministicSocialCaptureFinding {
  stage: StageName;
  severity: FindingSeverity;
  text: string;
  citations: Array<{
    source: CitationSource;
    url?: string;
    quote?: string;
    artifactPath?: string;
  }>;
}

export interface DeterministicSocialCaptureResult {
  capturePath: string;
  findings: DeterministicSocialCaptureFinding[];
  flags: string[];
}

type LooseRecord = Record<string, unknown>;

function safeObject(value: unknown): LooseRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : {};
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function cleanText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readJsonIfExists(filePath: string): LooseRecord | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as LooseRecord;
}

function normalizeName(value?: string): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeSnippet(value: string, limit = 280): string {
  const text = decodeHtml(value).replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3)}...`;
}

function ensureArrayField(record: LooseRecord, key: string): string[] {
  const current = safeArray<string>(record[key]).filter((item) => typeof item === "string" && item.trim());
  record[key] = current;
  return current;
}

function pushUnique(target: string[], value?: string): void {
  const item = cleanText(value);
  if (!item) return;
  if (!target.includes(item)) target.push(item);
}

function buildBaseCapture(input: DeterministicSocialCaptureInput): LooseRecord {
  return {
    artifactVersion: "social_capture_v1",
    ok: true,
    run: {
      startedAtISO: null,
      endedAtISO: null,
      durationSeconds: null,
      mode: "deterministic",
      modelId: "deterministic-social-capture",
    },
    nova: {
      sessionId: null,
      actId: null,
      logsDirTemp: null,
      replayHtmlTemp: null,
      logsDir: null,
      htmlReplayPath: null,
      numStepsExecuted: null,
      logsDirLocal: null,
      replayHtmlLocal: null,
      htmlReplayPathLocal: null,
      screenshots: [],
      warnings: [],
    },
    inputs: {
      candidateId: cleanText(input.candidateId),
      candidateName: input.candidateLabel,
      linkedinUrl: cleanText(input.linkedinUrl),
      githubUrl: cleanText(input.githubUrl),
      portfolioUrl: cleanText(input.portfolioUrl),
      webQueries: safeArray<string>(input.webQueries).filter(Boolean),
    },
    outputs: {
      stageStatus: {
        linkedin: {
          requested: Boolean(cleanText(input.linkedinUrl)),
          completed: false,
          status: cleanText(input.linkedinUrl) ? "pending" : "skipped",
        },
        github: {
          requested: Boolean(cleanText(input.githubUrl)),
          completed: false,
          status: cleanText(input.githubUrl) ? "pending" : "skipped",
        },
        portfolio: {
          requested: Boolean(cleanText(input.portfolioUrl)),
          completed: false,
          status: cleanText(input.portfolioUrl) ? "pending" : "skipped",
        },
        web: {
          requested: safeArray<string>(input.webQueries).length > 0,
          completed: false,
          status: safeArray<string>(input.webQueries).length > 0 ? "pending" : "skipped",
        },
      },
      finalSummaryText: null,
      linkedin: {
        url: cleanText(input.linkedinUrl),
        found: Boolean(cleanText(input.linkedinUrl)),
        status: cleanText(input.linkedinUrl) ? "pending" : "skipped",
        profileName: null,
        headline: null,
        location: null,
        currentCompany: null,
        school: null,
        topLinks: [],
        skills: [],
        evidence: [],
        missing: [],
        experienceCount: 0,
        notes: "",
      },
      github: {
        url: cleanText(input.githubUrl),
        found: Boolean(cleanText(input.githubUrl)),
        status: cleanText(input.githubUrl) ? "pending" : "skipped",
        username: null,
        displayName: null,
        bio: null,
        followers: null,
        following: null,
        contributionsLastYear: null,
        topLanguages: [],
        pinnedRepoCount: 0,
        pinnedRepos: [],
        evidence: [],
        missing: [],
        notes: "",
      },
      portfolio: {
        url: cleanText(input.portfolioUrl),
        found: Boolean(cleanText(input.portfolioUrl)),
        status: cleanText(input.portfolioUrl) ? "pending" : "skipped",
        ownerName: null,
        candidateLabel: input.candidateLabel,
        mismatchFlag: false,
        evidence: [],
        projectsReviewed: 0,
        projectHighlights: [],
        resumeFound: null,
        githubLinkFound: null,
        githubLinkMatchesExpected: "unknown",
        retroFound: null,
        warnings: [],
        notes: "",
      },
      web: {
        queries: safeArray<string>(input.webQueries).filter(Boolean),
        resultCount: 0,
        results: [],
      },
      flags: [],
      structured: {},
    },
    raw: {
      instruction: null,
      actResultPath: null,
      stageSummaries: null,
    },
    artifacts: {
      trace: {
        saved: true,
        format: "text",
        path: "nova_trace.txt",
        rawPath: "nova_trace_raw.txt",
        redacted: true,
        redactMode: "partial",
        containsThinkLines: false,
        containsActionLines: false,
        containsReturnLines: false,
        source: "none",
        diagnostics: ["Deterministic capture created without Nova transcript."],
      },
      returnBlock: {
        saved: true,
        path: "nova_return_block.txt",
        redacted: true,
        redactMode: "partial",
      },
    },
    warnings: [],
    error: null,
  };
}

function ensureTraceFiles(runDir: string): void {
  const traceRaw = path.join(runDir, "nova_trace_raw.txt");
  const trace = path.join(runDir, "nova_trace.txt");
  const returnBlock = path.join(runDir, "nova_return_block.txt");
  if (!fs.existsSync(traceRaw)) {
    fs.writeFileSync(
      traceRaw,
      "Deterministic capture mode: no Nova transcript available.\n",
      "utf-8",
    );
  }
  if (!fs.existsSync(trace)) {
    fs.writeFileSync(
      trace,
      "Deterministic capture mode: no Nova transcript available.\n",
      "utf-8",
    );
  }
  if (!fs.existsSync(returnBlock)) {
    fs.writeFileSync(
      returnBlock,
      "BEGIN_CAPTURE_JSON\n{}\nEND_CAPTURE_JSON\n",
      "utf-8",
    );
  }
}

function writeJsonAtomic(filePath: string, payload: unknown): void {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, serialized, "utf-8");
  JSON.parse(fs.readFileSync(tmpPath, "utf-8"));
  fs.renameSync(tmpPath, filePath);
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "AIHireAI-SocialScreen/1.0",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] ? normalizeSnippet(match[1], 120) : undefined);
}

function extractMeta(html: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([\\s\\S]*?)["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([\\s\\S]*?)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const content = cleanText(match?.[1] ? normalizeSnippet(match[1], 180) : undefined);
    if (content) return content;
  }
  return undefined;
}

function parseGithubUsername(url?: string): string | undefined {
  const raw = cleanText(url);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    const username = parsed.pathname.split("/").filter(Boolean)[0];
    return cleanText(username);
  } catch {
    return undefined;
  }
}

function extractPortfolioOwnerName(url: string, html: string): string | undefined {
  const title = extractTitle(html);
  const description = extractMeta(html, "description");

  const firebaseMatch = html.match(/([a-z]+(?:-[a-z]+){1,5})-portfolio/i);
  if (firebaseMatch?.[1]) {
    return toTitleCase(firebaseMatch[1]);
  }

  const explicitName = html.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b(?=.*portfolio)/i);
  if (explicitName?.[1]) {
    return normalizeSnippet(explicitName[1], 120);
  }

  if (title && /\bportfolio\b/i.test(title)) {
    const maybeName = title.replace(/\bportfolio\b/gi, "").replace(/[-|]/g, " ").trim();
    if (maybeName.split(/\s+/).filter(Boolean).length >= 1) {
      const titleName = toTitleCase(maybeName);
      if (titleName.length >= 3) return titleName;
    }
  }

  if (description && /\bportfolio\b/i.test(description)) {
    const maybeName = description.replace(/\bis where you find him\b/i, "").replace(/\bportfolio\b/gi, "").trim();
    if (maybeName.split(/\s+/).filter(Boolean).length >= 1) {
      return toTitleCase(maybeName);
    }
  }

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const hostLabel = host.split(".")[0];
    if (hostLabel.includes("-")) {
      return toTitleCase(hostLabel);
    }
  } catch {
    // ignore
  }

  return undefined;
}

function setStageStatus(
  capture: LooseRecord,
  stage: StageName,
  status: "ok" | "partial" | "blocked" | "skipped",
): void {
  const outputs = safeObject(capture.outputs);
  const stageStatus = safeObject(outputs.stageStatus);
  const current = safeObject(stageStatus[stage]);
  stageStatus[stage] = {
    ...current,
    requested: current.requested ?? true,
    completed: true,
    status,
  };
  outputs.stageStatus = stageStatus;
  capture.outputs = outputs;
}

function buildArtifactPath(runDir: string, fileName: string): string {
  return path.join(runDir, fileName);
}

export async function applyDeterministicSocialCapture(
  input: DeterministicSocialCaptureInput,
): Promise<DeterministicSocialCaptureResult> {
  const capturePath = path.join(input.runDir, "capture.json");
  const capture = readJsonIfExists(capturePath) ?? buildBaseCapture(input);
  const outputs = safeObject(capture.outputs);
  const inputs = safeObject(capture.inputs);
  const warnings = ensureArrayField(capture, "warnings");
  const flags = ensureArrayField(outputs, "flags");
  const findings: DeterministicSocialCaptureFinding[] = [];

  inputs.candidateId = cleanText(input.candidateId) ?? cleanText(String(inputs.candidateId ?? ""));
  inputs.candidateName = input.candidateLabel;
  if (cleanText(input.linkedinUrl)) inputs.linkedinUrl = cleanText(input.linkedinUrl);
  if (cleanText(input.githubUrl)) inputs.githubUrl = cleanText(input.githubUrl);
  if (cleanText(input.portfolioUrl)) inputs.portfolioUrl = cleanText(input.portfolioUrl);
  if (input.webQueries?.length) inputs.webQueries = input.webQueries.filter(Boolean);

  const linkedin = safeObject(outputs.linkedin);
  linkedin.url = cleanText(input.linkedinUrl) ?? cleanText(String(linkedin.url ?? ""));
  linkedin.found = Boolean(linkedin.url);
  ensureArrayField(linkedin, "evidence");
  ensureArrayField(linkedin, "missing");
  if (linkedin.url && !cleanText(String(linkedin.profileName ?? ""))) {
    pushUnique(linkedin.evidence as string[], "LinkedIn capture may be restricted by authentication or anti-bot measures; verify manually.");
    linkedin.notes = "Deterministic fallback could not reliably read LinkedIn profile details.";
    linkedin.status = "blocked";
    setStageStatus(capture, "linkedin", "blocked");
    findings.push({
      stage: "linkedin",
      severity: "info",
      text: "LinkedIn capture may be restricted; verify manually.",
      citations: [
        {
          source: "linkedin",
          url: cleanText(String(linkedin.url ?? "")),
          quote: "LinkedIn capture may be restricted by authentication or anti-bot measures; verify manually.",
          artifactPath: capturePath,
        },
      ],
    });
  }

  const github = safeObject(outputs.github);
  github.url = cleanText(input.githubUrl) ?? cleanText(String(github.url ?? ""));
  github.found = Boolean(github.url);
  ensureArrayField(github, "evidence");
  ensureArrayField(github, "missing");
  const githubUsername = parseGithubUsername(cleanText(String(github.url ?? "")));
  if (githubUsername) {
    github.username = githubUsername;
    const apiPayloadText = await fetchText(`https://api.github.com/users/${encodeURIComponent(githubUsername)}`);
    if (apiPayloadText) {
      try {
        const apiPayload = JSON.parse(apiPayloadText) as LooseRecord;
        const displayName = cleanText(String(apiPayload.name ?? ""));
        const bio = cleanText(String(apiPayload.bio ?? ""));
        github.displayName = displayName ?? github.displayName ?? null;
        github.bio = bio ?? github.bio ?? null;
        github.followers = typeof apiPayload.followers === "number" ? apiPayload.followers : github.followers ?? null;
        github.following = typeof apiPayload.following === "number" ? apiPayload.following : github.following ?? null;
        github.status = "partial";
        github.notes = "GitHub details collected from the public GitHub user API.";
        setStageStatus(capture, "github", "partial");
        if (displayName) {
          pushUnique(github.evidence as string[], `GitHub display name appears to be '${displayName}'.`);
        }
        if (bio) {
          pushUnique(github.evidence as string[], `GitHub bio: ${bio}`);
        }
        findings.push({
          stage: "github",
          severity: "info",
          text: displayName
            ? `GitHub profile resolved as ${displayName}.`
            : `GitHub profile ${githubUsername} was resolved.`,
          citations: [
            {
              source: "github",
              url: cleanText(String(github.url ?? "")),
              quote: displayName
                ? `GitHub display name appears to be '${displayName}'.`
                : `GitHub username '${githubUsername}' responded from the public API.`,
              artifactPath: capturePath,
            },
          ],
        });
      } catch {
        pushUnique(warnings, "GitHub public API response could not be parsed during deterministic fallback.");
      }
    }
  }

  const portfolio = safeObject(outputs.portfolio);
  portfolio.url = cleanText(input.portfolioUrl) ?? cleanText(String(portfolio.url ?? ""));
  portfolio.candidateLabel = input.candidateLabel;
  ensureArrayField(portfolio, "evidence");
  ensureArrayField(portfolio, "warnings");
  if (portfolio.url) {
    const html = await fetchText(String(portfolio.url));
    if (html) {
      const title = extractTitle(html);
      const description = extractMeta(html, "description");
      const ownerName =
        cleanText(String(portfolio.ownerName ?? "")) ??
        extractPortfolioOwnerName(String(portfolio.url), html);
      portfolio.found = true;
      portfolio.status = "partial";
      setStageStatus(capture, "portfolio", "partial");
      if (ownerName) {
        portfolio.ownerName = ownerName;
        pushUnique(portfolio.evidence as string[], `Visible portfolio owner name appears to be '${ownerName}'.`);
      }
      if (title) {
        pushUnique(portfolio.evidence as string[], `Portfolio title: ${title}`);
      }
      if (description) {
        pushUnique(portfolio.evidence as string[], `Portfolio description: ${description}`);
      }

      const mismatch =
        Boolean(ownerName) &&
        normalizeName(ownerName) !== normalizeName(input.candidateLabel) &&
        !normalizeName(ownerName).includes(normalizeName(input.candidateLabel)) &&
        !normalizeName(input.candidateLabel).includes(normalizeName(ownerName));
      portfolio.mismatchFlag = mismatch;
      if (mismatch) {
        pushUnique(
          portfolio.evidence as string[],
          `Visible portfolio owner name appears to be '${ownerName}', which does not match candidate label '${input.candidateLabel}'.`,
        );
        if (!flags.includes("IDENTITY_MISMATCH_WEBSITE_OWNER")) {
          flags.push("IDENTITY_MISMATCH_WEBSITE_OWNER");
        }
        findings.push({
          stage: "portfolio",
          severity: "critical",
          text: `Portfolio appears owned by ${ownerName}, not ${input.candidateLabel}.`,
          citations: [
            {
              source: "portfolio",
              url: cleanText(String(portfolio.url ?? "")),
              quote: `Visible portfolio owner name appears to be '${ownerName}', which does not match candidate label '${input.candidateLabel}'.`,
              artifactPath: capturePath,
            },
          ],
        });
      } else if (ownerName) {
        findings.push({
          stage: "portfolio",
          severity: "info",
          text: `Portfolio owner appears to be ${ownerName}.`,
          citations: [
            {
              source: "portfolio",
              url: cleanText(String(portfolio.url ?? "")),
              quote: `Visible portfolio owner name appears to be '${ownerName}'.`,
              artifactPath: capturePath,
            },
          ],
        });
      }
      portfolio.notes = "Portfolio details collected from the public homepage HTML during deterministic fallback.";
    } else {
      portfolio.status = "blocked";
      setStageStatus(capture, "portfolio", "blocked");
      pushUnique(portfolio.warnings as string[], "Portfolio URL could not be fetched during deterministic fallback.");
      findings.push({
        stage: "portfolio",
        severity: "warning",
        text: "Portfolio URL could not be fetched; verify manually.",
        citations: [
          {
            source: "portfolio",
            url: cleanText(String(portfolio.url ?? "")),
            quote: "Portfolio URL could not be fetched during deterministic fallback.",
            artifactPath: capturePath,
          },
        ],
      });
    }
  }

  const web = safeObject(outputs.web);
  web.queries = safeArray<string>(input.webQueries).filter(Boolean);
  if (safeArray<string>(web.queries).length > 0) {
    setStageStatus(capture, "web", "partial");
  }

  outputs.linkedin = linkedin;
  outputs.github = github;
  outputs.portfolio = portfolio;
  outputs.web = web;
  outputs.flags = flags;
  outputs.structured = {
    linkedin,
    github,
    portfolio,
    web,
  };
  capture.inputs = inputs;
  capture.outputs = outputs;

  ensureTraceFiles(input.runDir);
  writeJsonAtomic(capturePath, capture);

  return {
    capturePath,
    findings,
    flags,
  };
}
