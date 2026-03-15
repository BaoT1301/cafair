// Path: apps/web-client/src/app/api/aihire/social-screen/route.ts

import { NextResponse } from "next/server";
import {
  getSocialScreen,
  type GetSocialScreenInput,
} from "@/server/aihire/social-screen";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/aihire/social-screen",
    method: "POST",
    requiredFields: ["candidateId", "name"],
    optionalFields: [
      "roleTitle",
      "school",
      "resumeText",
      "linkedin",
      "github",
      "web",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GetSocialScreenInput;

    const result = await getSocialScreen(body);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request body",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}