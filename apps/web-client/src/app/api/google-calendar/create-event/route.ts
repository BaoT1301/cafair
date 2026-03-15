// POST /api/google-calendar/create-event — creates a Google Calendar event
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createEvent } from "@/lib/google-calendar";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const refreshToken = jar.get("gcal_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const body = await req.json() as {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    attendeeEmails?: string[];
    timeZone?: string;
  };

  try {
    const result = await createEvent(refreshToken, body);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
