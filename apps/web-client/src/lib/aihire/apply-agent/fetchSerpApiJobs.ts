// Path: apps/web-client/src/lib/aihire/apply-agent/fetchSerpApiJobs.ts

import type { ApplyAgentJob } from "@/lib/aihire/apply-agent/types";

type FetchSerpApiJobsInput = {
  queries?: string[];
  limit?: number;
};

export async function fetchSerpApiJobs(
  input: FetchSerpApiJobsInput = {},
): Promise<ApplyAgentJob[]> {
  const { queries = [], limit = 20 } = input;

  const apiKey = process.env.SERP_API_KEY;

  // Safe fallback for now if key is not configured.
  if (!apiKey) {
    const fallbackJobs: ApplyAgentJob[] = [
      {
        jobId: "serpapi_1",
        title: "Data Engineer Intern",
        company: "Fallback Data Co",
        location: "Remote",
        url: "https://example.com/jobs/data-engineer-intern",
        description:
          "Python SQL PostgreSQL ETL data pipelines AWS Airflow dbt analytics",
        source: "serpapi",
      },
      {
        jobId: "serpapi_2",
        title: "AI Software Engineer Intern",
        company: "Fallback AI Labs",
        location: "San Francisco, CA",
        url: "https://example.com/jobs/ai-software-engineer-intern",
        description:
          "Python TypeScript React Node.js LLM RAG Bedrock AWS APIs automation",
        source: "serpapi",
      },
    ];

    return fallbackJobs.slice(0, Math.max(1, limit));
  }

  // Real SerpAPI integration can be added here later.
  // For now we return deterministic placeholder results even if key exists.
  const queryText = queries.join(" ");

  const seededJobs: ApplyAgentJob[] = [
    {
      jobId: "serpapi_live_1",
      title: "Software Engineer Intern",
      company: "Search Result Tech",
      location: "Remote",
      url: "https://example.com/jobs/search-result-software-engineer-intern",
      description:
        `Derived from search: ${queryText}. Requires JavaScript TypeScript React Node.js AWS Git APIs.`,
      source: "serpapi",
    },
    {
      jobId: "serpapi_live_2",
      title: "Machine Learning Engineer Intern",
      company: "Search Result ML",
      location: "Boston, MA",
      url: "https://example.com/jobs/search-result-ml-engineer-intern",
      description:
        `Derived from search: ${queryText}. Requires Python PyTorch machine learning AWS data pipelines LLM.`,
      source: "serpapi",
    },
  ];

  return seededJobs.slice(0, Math.max(1, limit));
}