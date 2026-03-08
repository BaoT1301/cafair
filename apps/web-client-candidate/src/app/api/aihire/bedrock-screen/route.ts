// Path: apps/web-client/src/app/api/aihire/bedrock-screen/route.ts
//
// Next.js REST endpoint for AI Hire AI Bedrock screening.
// POST /api/aihire/bedrock-screen
//
// Expects JSON body:
// {
//   "candidateId": "cand_001",
//   "name": "Nguyen Phan Nguyen",
//   "roleTitle": "AI Music Engineer",
//   "companyName": "AI Hire AI",
//   "resumeText": "...",
//   "roleRequirements": ["PyTorch", "full-stack", "real-time systems"],
//   "transcriptText": "...",   // optional
//   "notes": "..."             // optional
// }
//
// Returns:
// {
//   ok: true,
//   result: { ...BedrockScreenResult }
// }

import { NextResponse } from "next/server";
import { z } from "zod";
import { getBedrockScreen } from "@/server/aihire/bedrock";

const BedrockScreenRequestSchema = z.object({
  candidateId: z.string().min(1, "candidateId is required"),
  name: z.string().min(1, "name is required"),
  roleTitle: z.string().min(1, "roleTitle is required"),
  companyName: z.string().optional(),
  resumeText: z.string().min(1, "resumeText is required"),
  roleRequirements: z.array(z.string()).optional().default([]),
  transcriptText: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const input = BedrockScreenRequestSchema.parse(json);

    const result = await getBedrockScreen({
      candidateId: input.candidateId,
      name: input.name,
      roleTitle: input.roleTitle,
      companyName: input.companyName,
      resumeText: input.resumeText,
      roleRequirements: input.roleRequirements,
      transcriptText: input.transcriptText,
      notes: input.notes,
    });

    return NextResponse.json(
      {
        ok: true,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        ok: false,
        error: "Bedrock screen request failed",
        message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/aihire/bedrock-screen",
      method: "POST",
      requiredFields: [
        "candidateId",
        "name",
        "roleTitle",
        "resumeText",
      ],
      optionalFields: [
        "companyName",
        "roleRequirements",
        "transcriptText",
        "notes",
      ],
    },
    { status: 200 }
  );
}