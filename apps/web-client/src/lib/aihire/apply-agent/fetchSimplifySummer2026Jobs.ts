import type { ApplyAgentJob } from "@/lib/aihire/apply-agent/types";

const SIMPLIFY_README_RAW_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md";

type ParsedJobDraft = {
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  description: string;
};

type MarkdownLink = {
  text: string;
  url: string;
};

function cleanText(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdownLinks(value: string): string {
  const withoutLinks = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  return cleanText(withoutLinks);
}

function resolveUrl(url: string): string {
  const trimmed = url.trim();

  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `https://github.com${trimmed}`;
  }

  return trimmed;
}

function looksLikeJobTableRow(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed.startsWith("|")) {
    return false;
  }

  if (trimmed.includes("---")) {
    return false;
  }

  if (/^\|\s*Company\s*\|/i.test(trimmed)) {
    return false;
  }

  const cells = trimmed
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  return cells.length >= 4;
}

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseMarkdownLink(cell: string): { text: string; url: string } | null {
  const match = cell.match(/\[([^\]]+)\]\(([^)]+)\)/);

  if (!match) {
    return null;
  }

  return {
    text: cleanText(match[1]),
    url: resolveUrl(match[2]),
  };
}

function extractRoleDetails(roleCell: string): {
  title: string;
  location: string | null;
} {
  const normalized = stripMarkdownLinks(roleCell);

  const locationPatterns = [
    /\b(Remote(?:\s+in\s+[A-Za-z ,.-]+)?)$/i,
    /\b(Hybrid(?:\s+in\s+[A-Za-z ,.-]+)?)$/i,
    /\b([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})$/,
    /\b([A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+)$/,
  ];

  for (const pattern of locationPatterns) {
    const match = normalized.match(pattern);

    if (!match || match.index === undefined) {
      continue;
    }

    const title = cleanText(normalized.slice(0, match.index));
    const location = cleanText(match[1]);

    if (title) {
      return {
        title,
        location: location || null,
      };
    }
  }

  return {
    title: normalized,
    location: null,
  };
}

function buildDescriptionFromRow(parts: {
  company: string | null;
  title: string;
  location: string | null;
  section: string | null;
}): string {
  const tokens = [
    parts.title,
    parts.company ?? "",
    parts.location ?? "",
    parts.section ?? "",
    "summer 2026 internship",
  ];

  return cleanText(
    tokens.filter((token) => Boolean(token)).join(" "),
  );
}

function parseMarkdownJobTable(markdown: string): ParsedJobDraft[] {
  const lines = markdown.split("\n");
  const jobs: ParsedJobDraft[] = [];
  let currentSection: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("## ")) {
      currentSection = cleanText(
        line.replace(/^##\s+/, ""),
      );
      continue;
    }

    if (!looksLikeJobTableRow(line)) {
      continue;
    }

    const cells = splitMarkdownRow(line);

    if (cells.length < 4) {
      continue;
    }

    const companyCell = cells[0] ?? "";
    const roleCell = cells[1] ?? "";
    const locationCell = cells[2] ?? "";
    const applicationCell = cells[3] ?? "";

    const companyLink = parseMarkdownLink(companyCell);
    const roleLink = parseMarkdownLink(roleCell);
    const applicationLink = parseMarkdownLink(applicationCell);

    const companyText = companyLink?.text ?? stripMarkdownLinks(companyCell);
    const company = companyText ? companyText : null;

    const roleParsed = extractRoleDetails(
      roleLink?.text ?? roleCell,
    );

    const explicitLocationText = stripMarkdownLinks(locationCell);
    const explicitLocation = explicitLocationText
      ? explicitLocationText
      : null;

    const title = roleParsed.title || "Internship Role";
    const location = explicitLocation || roleParsed.location;

    const url =
      applicationLink?.url ||
      roleLink?.url ||
      companyLink?.url ||
      "";

    const effectiveLocation =
      location ?? currentSection ?? null;

    const description = buildDescriptionFromRow({
      company,
      title,
      location: effectiveLocation,
      section: currentSection,
    });

    if (!title) {
      continue;
    }

    if (/^back to top$/i.test(title)) {
      continue;
    }

    if (/^company$/i.test(company ?? "")) {
      continue;
    }

    jobs.push({
      title,
      company,
      location,
      url,
      description,
    });
  }

  return jobs;
}

function addSeedFallbackJobs(): ApplyAgentJob[] {
  return [
    {
      jobId: "simplify_seed_1",
      title: "IT Automation Engineering Intern",
      company: "Flagship Pioneering",
      location: "Cambridge, MA",
      url:
        "https://job-boards.greenhouse.io/fspco-op012325/jobs/8433215002",
      description:
        "Python JavaScript AWS APIs automation Zapier Workato AI " +
        "cloud infrastructure full-stack applications VS Code",
      source: "simplify",
    },
    {
      jobId: "simplify_seed_2",
      title: "Software Engineering Intern",
      company: "New York Post",
      location: "NYC - 1211 Ave of the Americas",
      url:
        "https://dowjones.wd1.myworkdayjobs.com/" +
        "New_York_Post_Careers/job/" +
        "NYC---1211-Ave-of-the-Americas/" +
        "Software-Engineering-Intern_Job_Req_51878",
      description:
        "Software engineering internship focused on infrastructure " +
        "services, data pipelines, personalization systems, and custom " +
        "APIs across AWS and GCP. Uses Python, Node.js, HTTP, JSON, " +
        "APIs, EC2, Elasticsearch, S3, Vertex AI, Lambdas, DynamoDB, " +
        "Cloud Functions, Kubernetes, Glue, Athena, BigQuery, Git, " +
        "JIRA, agile, networking, containers, serverless, and " +
        "collaboration with product and data science teams.",
      source: "simplify",
    },
    {
      jobId: "simplify_seed_3",
      title:
        "Software Engineer Systems Research Internship, " +
        "Applied Emerging Talent (Summer 2026)",
      company: "OpenAI",
      location: "San Francisco, CA",
      url:
        "https://jobs.ashbyhq.com/openai/" +
        "13a9e4e4-505b-4545-8b2b-b0bcc09c2b4f/application",
      description:
        "Systems research internship focused on distributed systems, " +
        "storage, compute, scheduling, GPU utilization, job " +
        "orchestration, queuing, performance engineering, profiling, " +
        "scalability, reliability, observability, monitoring, " +
        "networking, data pipelines, caching, streaming, ML systems, " +
        "training, inference, evaluation infrastructure, tooling, " +
        "experiments, benchmarks, and systems research. Requires " +
        "coding in C++, Java, Python, or Rust.",
      source: "simplify",
    },
  ];
}

export async function fetchSimplifySummer2026Jobs(
  limit = 50,
): Promise<ApplyAgentJob[]> {
  const safeLimit = Math.max(
    1,
    Math.min(200, Math.floor(limit)),
  );

  try {
    const response = await fetch(SIMPLIFY_README_RAW_URL, {
      method: "GET",
      headers: {
        Accept:
          "text/plain, text/markdown;q=0.9, */*;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Simplify README: ${response.status}`,
      );
    }

    const markdown = await response.text();
    const parsed = parseMarkdownJobTable(markdown);

    if (parsed.length === 0) {
      return addSeedFallbackJobs().slice(0, safeLimit);
    }

    const normalizedJobs: ApplyAgentJob[] = parsed
      .slice(0, safeLimit)
      .map((job, index) => ({
        jobId: `simplify_${index + 1}`,
        title:
          cleanText(job.title) ||
          `Simplify Job ${index + 1}`,
        company: job.company ? cleanText(job.company) : null,
        location: job.location ? cleanText(job.location) : null,
        url: resolveUrl(job.url),
        description: cleanText(job.description),
        source: "simplify",
      }));

    return normalizedJobs;
  } catch (error) {
    console.error(
      "fetchSimplifySummer2026Jobs fallback triggered:",
      error,
    );

    return addSeedFallbackJobs().slice(0, safeLimit);
  }
}