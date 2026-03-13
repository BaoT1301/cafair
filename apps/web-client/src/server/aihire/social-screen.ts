// Path: apps/web-client/src/server/aihire/social-screen.ts
//
// Stable app-layer wrapper for social screening.
// The frontend/backend should call this instead of directly importing
// the agent service.

// Dynamic import so Vercel build succeeds without the agents package
type RunSocialScreenService = typeof import("../../../../agents/src/services/socialScreenService").runSocialScreenService;
let _runSocialScreenService: RunSocialScreenService | null = null;
async function loadSocialScreenAgent(): Promise<RunSocialScreenService> {
  if (!_runSocialScreenService) {
    try {
      const mod = await import("../../../../agents/src/services/socialScreenService");
      _runSocialScreenService = mod.runSocialScreenService;
    } catch {
      throw new Error("Social screen agent package not available in this environment");
    }
  }
  return _runSocialScreenService;
}

export type SocialScreenServiceResult = Record<string, unknown>;

export interface GetSocialScreenLinkedInExperience {
  title?: string;
  company?: string;
  start?: string;
  end?: string;
  description?: string;
}

export interface GetSocialScreenLinkedInProfile {
  url?: string;
  headline?: string;
  currentCompany?: string;
  school?: string;
  skills?: string[];
  experiences?: GetSocialScreenLinkedInExperience[];
}

export interface GetSocialScreenGitHubPinnedRepo {
  name?: string;
  description?: string;
  language?: string;
  stars?: number;
}

export interface GetSocialScreenGitHubProfile {
  url?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  contributionsLastYear?: number;
  pinnedRepos?: GetSocialScreenGitHubPinnedRepo[];
  topLanguages?: string[];
}

export interface GetSocialScreenWebResult {
  title?: string;
  snippet?: string;
  source?: string;
  url?: string;
}

export interface GetSocialScreenWebProfile {
  queries?: string[];
  results?: GetSocialScreenWebResult[];
}

export interface GetSocialScreenInput {
  candidateId: string;
  name: string;
  roleTitle?: string;
  school?: string;
  resumeText?: string;

  linkedin?: GetSocialScreenLinkedInProfile;

  github?: GetSocialScreenGitHubProfile;

  web?: GetSocialScreenWebProfile;

  useBedrock?: boolean;
}

export interface GetSocialScreenSuccess {
  ok: true;
  result: unknown;
}

export interface GetSocialScreenFailure {
  ok: false;
  error: string;
  details?: string;
}

export type GetSocialScreenResponse =
  | GetSocialScreenSuccess
  | GetSocialScreenFailure;

function cleanText(value?: string): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function getSocialScreen(
  input: GetSocialScreenInput,
): Promise<GetSocialScreenResponse> {
  try {
    if (!isNonEmptyString(input.candidateId)) {
      return {
        ok: false,
        error: "Missing required field: candidateId",
      };
    }

    if (!isNonEmptyString(input.name)) {
      return {
        ok: false,
        error: "Missing required field: name",
      };
    }

    let linkedin:
      | {
          url: string;
          headline?: string;
          currentCompany?: string;
          school?: string;
          skills?: string[];
          experiences?: Array<{
            title: string;
            company: string;
            start: string;
            end?: string;
            description?: string;
          }>;
        }
      | undefined;

    if (input.linkedin) {
      const linkedinUrl = cleanText(input.linkedin.url);

      if (linkedinUrl) {
        const experiences = Array.isArray(input.linkedin.experiences)
          ? input.linkedin.experiences.reduce<
              Array<{
                title: string;
                company: string;
                start: string;
                end?: string;
                description?: string;
              }>
            >((acc, exp) => {
              const title = cleanText(exp?.title);
              const company = cleanText(exp?.company);
              const start = cleanText(exp?.start);

              // only keep rows that satisfy the service contract
              if (!title || !company || !start) {
                return acc;
              }

              acc.push({
                title,
                company,
                start,
                end: cleanText(exp?.end),
                description: cleanText(exp?.description),
              });

              return acc;
            }, [])
          : [];

        linkedin = {
          url: linkedinUrl,
          headline: cleanText(input.linkedin.headline),
          currentCompany: cleanText(input.linkedin.currentCompany),
          school: cleanText(input.linkedin.school),
          skills: Array.isArray(input.linkedin.skills)
            ? input.linkedin.skills
                .filter(isNonEmptyString)
                .map((s) => s.trim())
            : [],
          experiences,
        };
      }
    }

    let github:
      | {
          url: string;
          username?: string;
          displayName?: string;
          bio?: string;
          followers?: number;
          following?: number;
          contributionsLastYear?: number;
          pinnedRepos?: Array<{
            name: string;
            description?: string;
            language?: string;
            stars?: number;
          }>;
          topLanguages?: string[];
        }
      | undefined;

    if (input.github) {
      const githubUrl = cleanText(input.github.url);

      if (githubUrl) {
        const pinnedRepos = Array.isArray(input.github.pinnedRepos)
          ? input.github.pinnedRepos.reduce<
              Array<{
                name: string;
                description?: string;
                language?: string;
                stars?: number;
              }>
            >((acc, repo) => {
              const repoName = cleanText(repo?.name);

              if (!repoName) return acc;

              acc.push({
                name: repoName,
                description: cleanText(repo?.description),
                language: cleanText(repo?.language),
                stars: typeof repo?.stars === "number" ? repo.stars : undefined,
              });

              return acc;
            }, [])
          : [];

        github = {
          url: githubUrl,
          username: cleanText(input.github.username),
          displayName: cleanText(input.github.displayName),
          bio: cleanText(input.github.bio),
          followers:
            typeof input.github.followers === "number"
              ? input.github.followers
              : undefined,
          following:
            typeof input.github.following === "number"
              ? input.github.following
              : undefined,
          contributionsLastYear:
            typeof input.github.contributionsLastYear === "number"
              ? input.github.contributionsLastYear
              : undefined,
          pinnedRepos,
          topLanguages: Array.isArray(input.github.topLanguages)
            ? input.github.topLanguages
                .filter(isNonEmptyString)
                .map((s) => s.trim())
            : [],
        };
      }
    }

    let web:
      | {
          queries?: string[];
          results?: Array<{
            title: string;
            snippet?: string;
            source?: string;
            url?: string;
          }>;
        }
      | undefined;

    if (input.web) {
      const queries = Array.isArray(input.web.queries)
        ? input.web.queries.filter(isNonEmptyString).map((q) => q.trim())
        : [];

      const results = Array.isArray(input.web.results)
        ? input.web.results.reduce<
            Array<{
              title: string;
              snippet?: string;
              source?: string;
              url?: string;
            }>
          >((acc, r) => {
            const title = cleanText(r?.title);

            if (!title) return acc;

            acc.push({
              title,
              snippet: cleanText(r?.snippet),
              source: cleanText(r?.source),
              url: cleanText(r?.url),
            });

            return acc;
          }, [])
        : [];

      if (queries.length > 0 || results.length > 0) {
        web = {
          queries,
          results,
        };
      }
    }

    const runSocialScreenService = await loadSocialScreenAgent();
    const result = await runSocialScreenService({
      candidateId: input.candidateId.trim(),
      name: input.name.trim(),
      roleTitle: cleanText(input.roleTitle),
      school: cleanText(input.school),
      resumeText: cleanText(input.resumeText),
      linkedin,
      github,
      web,
      useBedrock:
        typeof input.useBedrock === "boolean" ? input.useBedrock : undefined,
    });

    return {
      ok: true,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      error: "Failed to run social screen",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
