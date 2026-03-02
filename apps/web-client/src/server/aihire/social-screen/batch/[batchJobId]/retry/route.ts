import { NextResponse } from "next/server";
import {
  getSocialScreenBatchJob,
  resetSocialScreenBatchJob,
} from "@/lib/aihire/socialScreenBatchStore";
import { runSocialScreenBatchJob } from "@/lib/aihire/runSocialScreenBatchJob";

type RouteContext = {
  params: Promise<{
    batchJobId: string;
  }>;
};

export async function POST(_req: Request, context: RouteContext) {
  try {
    const { batchJobId } = await context.params;

    const existingJob = getSocialScreenBatchJob(batchJobId);

    if (!existingJob) {
      return NextResponse.json(
        {
          ok: false,
          error: "Batch job not found",
          batchJobId,
        },
        { status: 404 },
      );
    }

    const resetJob = resetSocialScreenBatchJob(batchJobId);

    if (!resetJob) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to reset batch job",
          batchJobId,
        },
        { status: 500 },
      );
    }

    void runSocialScreenBatchJob(batchJobId).catch((error) => {
      console.error("Failed to rerun social screen batch job:", error);
    });

    return NextResponse.json(
      {
        ok: true,
        batchJobId: resetJob.batchJobId,
        status: resetJob.status,
        totalCandidates: resetJob.totalCandidates,
        completedCandidates: resetJob.completedCandidates,
        failedCandidates: resetJob.failedCandidates,
        message: "Batch retry started",
      },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to retry batch job",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}