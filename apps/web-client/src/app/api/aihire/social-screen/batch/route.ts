import { NextResponse } from "next/server";
import { createSocialScreenBatchJob } from "@aihire/socialScreenBatchStore";
import { runSocialScreenBatchJob } from "@aihire/runSocialScreenBatchJob";

type CandidateInput = {
  candidateId: string;
  name: string;
  roleTitle?: string;
  school?: string;
  resumeText?: string;
};

type CreateBatchRequest = {
  candidates: CandidateInput[];
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Social screen batch endpoint is live.",
    methods: ["GET", "POST"],
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBatchRequest;

    if (!body || !Array.isArray(body.candidates) || body.candidates.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Request body must include a non-empty candidates array.",
        },
        { status: 400 },
      );
    }

    const normalizedCandidates = body.candidates.map((candidate, index) => ({
      candidateId:
        typeof candidate.candidateId === "string" && candidate.candidateId.trim()
          ? candidate.candidateId.trim()
          : `candidate_${index + 1}`,
      name:
        typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : `Candidate ${index + 1}`,
      roleTitle:
        typeof candidate.roleTitle === "string" ? candidate.roleTitle.trim() : "",
      school:
        typeof candidate.school === "string" ? candidate.school.trim() : "",
      resumeText:
        typeof candidate.resumeText === "string" ? candidate.resumeText : "",
    }));

    const batchJob = await createSocialScreenBatchJob(normalizedCandidates);

    void runSocialScreenBatchJob(batchJob.batchJobId).catch((error) => {
      console.error("Failed to run social screen batch job:", error);
    });

    return NextResponse.json(
      {
        ok: true,
        batchJobId: batchJob.batchJobId,
        status: batchJob.status,
        totalCandidates: batchJob.totalCandidates,
        createdAt: batchJob.createdAt,
      },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create social screen batch job",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}