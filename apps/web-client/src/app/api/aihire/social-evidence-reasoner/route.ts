import { NextResponse } from "next/server";
import {
  getSocialScreenFromEvidencePacket,
  type GetSocialEvidenceReasonerInput,
} from "@/server/aihire/social-evidence-reasoner";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/aihire/social-evidence-reasoner",
    method: "POST",
    requiredFields: ["runDir or evidencePacketPath"],
    optionalFields: ["candidateId", "roleTitle", "companyName"],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GetSocialEvidenceReasonerInput;
    const result = await getSocialScreenFromEvidencePacket(body);

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
      { status: 400 },
    );
  }
}

