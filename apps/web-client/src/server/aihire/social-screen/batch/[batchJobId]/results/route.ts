import { NextResponse } from "next/server";
import {
  getSocialScreenBatchJob,
} from "@/lib/aihire/socialScreenBatchStore.db";
import type { SocialScreenBatchCandidateResult } from "@/lib/aihire/socialScreenBatchTypes";

type RouteContext = {
  params: Promise<{
    batchJobId: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { batchJobId } = await context.params;

    const job = await getSocialScreenBatchJob(batchJobId);

    if (!job) {
      return NextResponse.json(
        {
          ok: false,
          error: "Batch job not found",
          batchJobId,
        },
        { status: 404 },
      );
    }

    const recruiterResults = job.results.map(
      (candidate: SocialScreenBatchCandidateResult) => ({
        candidateId: candidate.candidateId,
        name: candidate.name,
        ok: candidate.ok,
        status: candidate.status,
        fitScore: candidate.result?.fitScore ?? null,
        risk: candidate.result?.risk ?? null,
        summary: candidate.result?.summary ?? null,
        flags: candidate.result?.flags ?? [],
        error: candidate.error ?? null,
      }),
    );

    return NextResponse.json({
      ok: true,
      batchJobId: job.batchJobId,
      status: job.status,
      totalCandidates: job.totalCandidates,
      completedCandidates: job.completedCandidates,
      failedCandidates: job.failedCandidates,
      results: recruiterResults,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch batch results",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}