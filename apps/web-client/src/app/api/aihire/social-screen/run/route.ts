import { NextResponse } from "next/server";
import {
  startSocialScreenRun,
  type StartSocialScreenRunInput,
} from "@/server/aihire/social-screen-runner";
import type { SocialScreenRunRequest } from "@/server/aihire/social-screen/types";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/aihire/social-screen/run",
    method: "POST",
    requiredFields: ["candidateLabel"],
    optionalFields: [
      "candidateId",
      "mode",
      "replayRunDir",
      "linkedinUrl",
      "githubUrl",
      "portfolioUrl",
      "webQueries",
      "roleTitle",
      "companyName",
      "localBrowser",
      "manualLinkedinLogin",
      "traceRedact",
      "useRealBedrock",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SocialScreenRunRequest;
    const result = await startSocialScreenRun(body as StartSocialScreenRunInput);

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to start social screen run",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
