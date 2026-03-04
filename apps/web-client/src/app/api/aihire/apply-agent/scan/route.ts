// Path: apps/web-client/src/app/api/aihire/apply-agent/scan/route.ts

import { NextResponse } from "next/server";
import { fetchSimplifySummer2026Jobs } from "@/lib/aihire/apply-agent/fetchSimplifySummer2026Jobs";
import { fetchSerpApiJobs } from "@/lib/aihire/apply-agent/fetchSerpApiJobs";
import { rankJobsByKeyword } from "@/lib/aihire/apply-agent/rankJobsByKeyword";
import { rerankJobsWithBedrock } from "@/lib/aihire/apply-agent/rerankJobsWithBedrock";
import type {
  ApplyAgentJob,
  BedrockRankedJob,
} from "@/lib/aihire/apply-agent/types";

type ScanRequest = {
  resumeText: string;
  threshold?: number;
  limit?: number;
};

function inferAiMode(): "bedrock" | "heuristic" {
  const hasAwsCreds =
    Boolean(process.env.AWS_REGION) &&
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  return hasAwsCreds ? "bedrock" : "heuristic";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ScanRequest;

    if (!body?.resumeText || typeof body.resumeText !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "resumeText is required and must be a string.",
        },
        { status: 400 },
      );
    }

    const threshold =
      typeof body.threshold === "number" && body.threshold > 0
        ? Math.floor(body.threshold)
        : 3;

    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? Math.floor(body.limit)
        : 10;

    let sourceUsed: "simplify" | "serpapi" = "simplify";
    let fallbackUsed = false;

    const simplifyJobs = await fetchSimplifySummer2026Jobs(limit);

    const simplifyKeywordPhase = rankJobsByKeyword({
      resumeText: body.resumeText,
      jobs: simplifyJobs,
      threshold,
    });

    let sourceJobs: ApplyAgentJob[] = simplifyJobs;
    let sourceKeywordPhase = simplifyKeywordPhase;
    let keywordShortlist = simplifyKeywordPhase.recommendedJobs;

    if (keywordShortlist.length === 0) {
      fallbackUsed = true;
      sourceUsed = "serpapi";

      const serpJobs = await fetchSerpApiJobs({
        queries: [
          "software engineer intern",
          "data engineer intern",
          "ai engineer intern",
          "machine learning engineer intern",
          "full stack engineer intern",
          "backend engineer intern",
          "platform engineer intern",
        ],
        limit,
      });

      const serpKeywordPhase = rankJobsByKeyword({
        resumeText: body.resumeText,
        jobs: serpJobs,
        threshold,
      });

      sourceJobs = serpJobs;
      sourceKeywordPhase = serpKeywordPhase;
      keywordShortlist = serpKeywordPhase.recommendedJobs;
    }

    const aiMode = inferAiMode();

    const aiRankedJobs = await rerankJobsWithBedrock({
      resumeText: body.resumeText,
      jobs: keywordShortlist,
      threshold,
    });

    const recommendedJobs = aiRankedJobs.filter(
      (job: BedrockRankedJob) => job.recommended,
    );

    return NextResponse.json({
      ok: true,
      threshold,
      limit,
      sourceUsed,
      fallbackUsed,
      aiMode,
      totalSourceJobs: sourceJobs.length,
      totalKeywordRankedJobs: sourceKeywordPhase.rankedJobs.length,
      keywordShortlistCount: keywordShortlist.length,
      aiRankedCount: aiRankedJobs.length,
      sourceResumeKeywordCount: sourceKeywordPhase.resumeKeywords.length,
      sourceResumeKeywords: sourceKeywordPhase.resumeKeywords,
      keywordRankedJobs: sourceKeywordPhase.rankedJobs,
      recommendedJobs,
      aiRankedJobs,
      message: fallbackUsed
        ? "No strong Simplify matches were found, so fallback search was used before AI reranking."
        : "Simplify jobs were scanned, keyword-filtered, and AI-reranked successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to scan job sources",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}