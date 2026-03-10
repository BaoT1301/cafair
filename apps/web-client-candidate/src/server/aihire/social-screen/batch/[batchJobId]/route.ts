import { NextResponse } from "next/server";
import { getSocialScreenBatchJob } from "@/lib/aihire/socialScreenBatchStore.db";

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

    return NextResponse.json({
      ok: true,
      batchJobId: job.batchJobId,
      status: job.status,
      totalCandidates: job.totalCandidates,
      completedCandidates: job.completedCandidates,
      failedCandidates: job.failedCandidates,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch batch job",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}