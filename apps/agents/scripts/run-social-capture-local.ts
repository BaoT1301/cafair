// Path: apps/llm/agents/scripts/run-social-capture-local.ts
//
// Visible local browser social capture runner (Playwright).
//
// Purpose:
// - opens real browser tabs on your machine
// - visits LinkedIn / GitHub / web search pages
// - extracts lightweight visible signals
// - prints normalized JSON for your social-screen pipeline
//
// Notes:
// - This is for local demo/debug, not production scraping.
// - Selectors are intentionally lightweight and fallback-friendly.
// - Some sites (especially LinkedIn) may block automation or require login.
// - Use headed mode by default so you can watch the browser actions.
//
// Run examples:
//   npx tsx apps/llm/agents/scripts/run-social-capture-local.ts \
//     "Nguyen Phan Nguyen" \
//     --linkedin "https://www.linkedin.com/in/nguyenpn1/" \
//     --github "https://github.com/ngstephen1" \
//     --web-query "Nguyen Phan Nguyen hackathon" \
//     --web-query "Nguyen Phan Nguyen developer" \
//     --pretty
//
// Optional:
//   --headless            # run without visible browser
//   --timeout-ms 15000    # per-page timeout
//
// Prereq:
//   npm install -D playwright
//   npx playwright install

import { chromium, type Browser, type Page } from "playwright";

type Maybe<T> = T | null | undefined;

interface LinkedInCapture {
  url: string;
  found: boolean;
  headline?: string | null;
  currentCompany?: string | null;
  school?: string | null;
  skills?: string[] | null;
  experiences?: Array<{
    title?: string | null;
    company?: string | null;
    start?: string | null;
    end?: string | null;
    description?: string | null;
  }> | null;
  notes?: string | null;
}

interface GitHubCapture {
  url: string;
  found: boolean;
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  followers?: number | null;
  following?: number | null;
  contributionsLastYear?: number | null;
  pinnedRepos?: Array<{
    name: string;
    description?: string | null;
    language?: string | null;
    stars?: number | null;
  }> | null;
  topLanguages?: string[] | null;
  notes?: string | null;
}

interface WebCaptureResult {
  title: string;
  snippet?: string | null;
  source?: string | null;
  url?: string | null;
}

interface WebCapture {
  queries: string[];
  results: WebCaptureResult[];
  notes?: string | null;
}

interface SocialCaptureOutput {
  ok: boolean;
  mode: "local-playwright";
  candidateName: string;
  linkedin?: LinkedInCapture | null;
  github?: GitHubCapture | null;
  web: WebCapture;
  warnings: string[];
  raw?: {
    linkedin?: Record<string, unknown>;
    github?: Record<string, unknown>;
    web?: Record<string, unknown>;
  };
}

interface CliArgs {
  candidateName: string;
  linkedinUrl?: string;
  githubUrl?: string;
  webQueries: string[];
  headless: boolean;
  pretty: boolean;
  timeoutMs: number;
}

function cleanText(value: Maybe<string>): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.replace(/\s+/g, " ").trim();
  return v || undefined;
}

function uniq(values: Array<Maybe<string>>): string[] {
  return Array.from(
    new Set(
      values
        .map((v) => cleanText(v))
        .filter((v): v is string => Boolean(v)),
    ),
  );
}

function parseIntLoose(value: Maybe<string>): number | undefined {
  const text = cleanText(value);
  if (!text) return undefined;
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

function githubUsernameFromUrl(url?: string): string | undefined {
  const clean = cleanText(url);
  if (!clean) return undefined;
  const parts = clean.replace(/\/+$/, "").split("/");
  return cleanText(parts[parts.length - 1]);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function getArgValue(name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) {
      values.push(process.argv[i + 1]);
    }
  }
  return values;
}

function parseCliArgs(): CliArgs {
  const positional = process.argv.slice(2).filter((arg, idx, arr) => {
    if (arg.startsWith("--")) return false;
    const prev = arr[idx - 1];
    if (prev && prev.startsWith("--")) return false;
    return true;
  });

  const candidateName = cleanText(positional[0]);
  if (!candidateName) {
    throw new Error("candidateName is required as the first positional argument.");
  }

  const linkedinUrl = cleanText(getArgValue("--linkedin")[0]);
  const githubUrl = cleanText(getArgValue("--github")[0]);
  const webQueries = getArgValue("--web-query")
    .map((q) => cleanText(q))
    .filter((q): q is string => Boolean(q));

  const timeoutRaw = cleanText(getArgValue("--timeout-ms")[0]);
  const timeoutMs =
    timeoutRaw && Number.isFinite(Number(timeoutRaw)) ? Number(timeoutRaw) : 15000;

  return {
    candidateName,
    linkedinUrl,
    githubUrl,
    webQueries,
    headless: hasFlag("--headless"),
    pretty: hasFlag("--pretty"),
    timeoutMs,
  };
}

async function safeGoto(page: Page, url: string, timeoutMs: number): Promise<void> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
}

async function getText(page: Page, selectors: string[]): Promise<string | undefined> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      const count = await locator.count();
      if (count < 1) continue;
      const text = cleanText(await locator.textContent());
      if (text) return text;
    } catch {
      // ignore and try next selector
    }
  }
  return undefined;
}

async function getTexts(page: Page, selectors: string[], limit = 5): Promise<string[]> {
  const results: string[] = [];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count < 1) continue;

      const capped = Math.min(count, limit);
      for (let i = 0; i < capped; i += 1) {
        const text = cleanText(await locator.nth(i).textContent());
        if (text) results.push(text);
      }

      if (results.length) break;
    } catch {
      // ignore and try next selector
    }
  }

  return uniq(results).slice(0, limit);
}

async function captureLinkedIn(
  browser: Browser,
  url: string,
  timeoutMs: number,
): Promise<{ data: LinkedInCapture; raw: Record<string, unknown>; warnings: string[] }> {
  const page = await browser.newPage();
  const warnings: string[] = [];

  try {
    await safeGoto(page, url, timeoutMs);
    await page.waitForTimeout(1500);

    const title = cleanText(await page.title());
    const bodyText = cleanText(await page.locator("body").textContent());

    const headline =
      (await getText(page, [
        "div.text-body-medium.break-words",
        ".top-card-layout__headline",
        "h2.top-card-layout__headline",
      ])) ??
      undefined;

    const currentCompany =
      (await getText(page, [
        "#experience ~ * li span[aria-hidden='true']",
        ".top-card-layout__first-subline",
      ])) ??
      undefined;

    const school =
      (await getText(page, [
        "#education ~ * li span[aria-hidden='true']",
        ".top-card-layout__second-subline",
      ])) ??
      undefined;

    const skills = await getTexts(page, [
      "#skills ~ * span[aria-hidden='true']",
      "section:has-text('Skills') span[aria-hidden='true']",
    ], 8);

    const experienceBullets = await getTexts(page, [
      "#experience ~ * li",
      "section:has-text('Experience') li",
    ], 4);

    if (!headline && !bodyText) {
      warnings.push("LinkedIn page loaded but no readable text was extracted.");
    }

    if (
      bodyText &&
      /sign in|join now|login|authwall/i.test(bodyText)
    ) {
      warnings.push("LinkedIn likely requires login or hit an auth wall.");
    }

    const data: LinkedInCapture = {
      url,
      found: true,
      headline: headline ?? null,
      currentCompany: currentCompany ?? null,
      school: school ?? null,
      skills: skills.length ? skills : null,
      experiences: experienceBullets.length
        ? experienceBullets.map((item) => ({
            title: item,
          }))
        : null,
      notes:
        headline || skills.length || experienceBullets.length
          ? "Local Playwright capture completed."
          : "Limited LinkedIn extraction. Page may require login or layout-specific selectors.",
    };

    return {
      data,
      raw: {
        title,
        extractedHeadline: headline ?? null,
        extractedCurrentCompany: currentCompany ?? null,
        extractedSchool: school ?? null,
        extractedSkills: skills,
        extractedExperienceBullets: experienceBullets,
      },
      warnings,
    };
  } finally {
    await page.close();
  }
}

async function captureGitHub(
  browser: Browser,
  url: string,
  timeoutMs: number,
): Promise<{ data: GitHubCapture; raw: Record<string, unknown>; warnings: string[] }> {
  const page = await browser.newPage();
  const warnings: string[] = [];

  try {
    await safeGoto(page, url, timeoutMs);
    await page.waitForTimeout(1500);

    const username = githubUsernameFromUrl(url);
    const displayName = await getText(page, [
      "span.p-name",
      "span[itemprop='name']",
    ]);

    const bio = await getText(page, [
      "div.p-note",
      "div.user-profile-bio",
    ]);

    const followersText = await getText(page, [
      "a[href$='?tab=followers'] span.text-bold",
      "a[href*='followers'] span",
    ]);

    const followingText = await getText(page, [
      "a[href$='?tab=following'] span.text-bold",
      "a[href*='following'] span",
    ]);

    const contributionsText = await getText(page, [
      "h2.f4.text-normal.mb-2",
      ".js-yearly-contributions h2",
    ]);

    const pinnedRepoNames = await getTexts(page, [
      'section [itemprop="name codeRepository"]',
      'ol.pinned-items-list span.repo',
    ], 6);

    const topLanguages = await getTexts(page, [
      "ul.list-style-none li span.color-fg-default.text-bold",
      "span[itemprop='programmingLanguage']",
    ], 6);

    const bodyText = cleanText(await page.locator("body").textContent());
    if (!bodyText) {
      warnings.push("GitHub page loaded but no readable text was extracted.");
    }

    const pinnedRepos = pinnedRepoNames.map((name) => ({ name }));

    const data: GitHubCapture = {
      url,
      found: true,
      username: username ?? null,
      displayName: displayName ?? null,
      bio: bio ?? null,
      followers: parseIntLoose(followersText) ?? null,
      following: parseIntLoose(followingText) ?? null,
      contributionsLastYear: parseIntLoose(contributionsText) ?? null,
      pinnedRepos: pinnedRepos.length ? pinnedRepos : null,
      topLanguages: topLanguages.length ? topLanguages : null,
      notes:
        displayName || pinnedRepos.length || topLanguages.length
          ? "Local Playwright capture completed."
          : "Limited GitHub extraction. Selectors may need adjustment.",
    };

    return {
      data,
      raw: {
        extractedDisplayName: displayName ?? null,
        extractedBio: bio ?? null,
        extractedFollowersText: followersText ?? null,
        extractedFollowingText: followingText ?? null,
        extractedContributionsText: contributionsText ?? null,
        extractedPinnedRepoNames: pinnedRepoNames,
        extractedTopLanguages: topLanguages,
      },
      warnings,
    };
  } finally {
    await page.close();
  }
}

async function captureWebSearch(
  browser: Browser,
  queries: string[],
  timeoutMs: number,
): Promise<{ data: WebCapture; raw: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = [];
  const allResults: WebCaptureResult[] = [];
  const rawQueries: Record<string, unknown>[] = [];

  for (const query of queries) {
    const page = await browser.newPage();

    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await safeGoto(page, searchUrl, timeoutMs);
      await page.waitForTimeout(1500);

      const bodyText = cleanText(await page.locator("body").textContent());
      if (bodyText && /unusual traffic|captcha|sorry/i.test(bodyText)) {
        warnings.push(`Google may have throttled automated access for query: ${query}`);
      }

      const cards = page.locator("div.g");
      const count = await cards.count();
      const localResults: WebCaptureResult[] = [];

      for (let i = 0; i < Math.min(count, 3); i += 1) {
        const card = cards.nth(i);
        const title = cleanText(await card.locator("h3").first().textContent().catch(() => null));
        if (!title) continue;

        const snippet = cleanText(
          await card.locator("div.VwiC3b, span.aCOpRe").first().textContent().catch(() => null),
        );

        const url = await card.locator("a").first().getAttribute("href").catch(() => null);

        localResults.push({
          title,
          snippet: snippet ?? null,
          source: "google",
          url: cleanText(url) ?? null,
        });
      }

      allResults.push(...localResults);
      rawQueries.push({
        query,
        resultCount: localResults.length,
        titles: localResults.map((r) => r.title),
      });
    } finally {
      await page.close();
    }
  }

  return {
    data: {
      queries,
      results: allResults,
      notes:
        allResults.length > 0
          ? "Local Playwright web capture completed."
          : "No web search results were extracted.",
    },
    raw: {
      queryDiagnostics: rawQueries,
    },
    warnings,
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs();
  const warnings: string[] = [];

  const browser = await chromium.launch({
    headless: args.headless,
    slowMo: args.headless ? 0 : 250,
  });

  try {
    let linkedin: LinkedInCapture | null = null;
    let github: GitHubCapture | null = null;
    let web: WebCapture = {
      queries: args.webQueries,
      results: [],
      notes: "No web queries provided.",
    };

    const raw: SocialCaptureOutput["raw"] = {};

    if (args.linkedinUrl) {
      const linkedInCapture = await captureLinkedIn(browser, args.linkedinUrl, args.timeoutMs);
      linkedin = linkedInCapture.data;
      raw.linkedin = linkedInCapture.raw;
      warnings.push(...linkedInCapture.warnings);
    }

    if (args.githubUrl) {
      const gitHubCapture = await captureGitHub(browser, args.githubUrl, args.timeoutMs);
      github = gitHubCapture.data;
      raw.github = gitHubCapture.raw;
      warnings.push(...gitHubCapture.warnings);
    }

    if (args.webQueries.length > 0) {
      const webCapture = await captureWebSearch(browser, args.webQueries, args.timeoutMs);
      web = webCapture.data;
      raw.web = webCapture.raw;
      warnings.push(...webCapture.warnings);
    }

    const payload: SocialCaptureOutput = {
      ok: true,
      mode: "local-playwright",
      candidateName: args.candidateName,
      linkedin,
      github,
      web,
      warnings,
      raw,
    };

    const json = args.pretty
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(payload);

    console.log(json);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "Failed to run local Playwright social capture",
        details: message,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});