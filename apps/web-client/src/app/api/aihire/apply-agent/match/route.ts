// Path: apps/web-client/src/app/api/aihire/apply-agent/match/route.ts

import { NextResponse } from "next/server";
import { rankJobsByKeyword } from "@/lib/aihire/apply-agent/rankJobsByKeyword";
import type { ApplyAgentJob } from "@/lib/aihire/apply-agent/types";

type MatchRequest = {
  resumeText: string;
  jobs: Array<{
    jobId?: string;
    title?: string;
    company?: string;
    location?: string;
    url?: string;
    description?: string;
    source?: "simplify" | "serpapi";
  }>;
  threshold?: number;
  minMatchedKeywords?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MatchRequest;

    if (!body?.resumeText || typeof body.resumeText !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "resumeText is required and must be a string.",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "jobs is required and must be a non-empty array.",
        },
        { status: 400 },
      );
    }

    const minMatchedKeywords =
      typeof body.threshold === "number" && body.threshold > 0
        ? Math.floor(body.threshold)
        : typeof body.minMatchedKeywords === "number" && body.minMatchedKeywords > 0
          ? Math.floor(body.minMatchedKeywords)
          : 3;

    const normalizedJobs: ApplyAgentJob[] = body.jobs.map((job, index) => ({
      jobId:
        typeof job.jobId === "string" && job.jobId.trim()
          ? job.jobId.trim()
          : `job_${index + 1}`,
      title:
        typeof job.title === "string" && job.title.trim()
          ? job.title.trim()
          : `Job ${index + 1}`,
      company:
        typeof job.company === "string" && job.company.trim()
          ? job.company.trim()
          : null,
      location:
        typeof job.location === "string" && job.location.trim()
          ? job.location.trim()
          : null,
      url: typeof job.url === "string" ? job.url.trim() : "",
      description: typeof job.description === "string" ? job.description : "",
      source: job.source === "serpapi" ? "serpapi" : "simplify",
    }));

    const result = rankJobsByKeyword({
      resumeText: body.resumeText,
      jobs: normalizedJobs,
      threshold: minMatchedKeywords,
    });

    return NextResponse.json({
      ok: true,
      minMatchedKeywords,
      totalJobs: result.rankedJobs.length,
      resumeKeywordCount: result.resumeKeywords.length,
      resumeKeywords: result.resumeKeywords,
      matches: result.rankedJobs,
      recommendedJobs: result.recommendedJobs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to rank jobs against resume",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}