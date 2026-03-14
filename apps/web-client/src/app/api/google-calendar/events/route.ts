// GET /api/google-calendar/events?date=YYYY-MM-DD — returns real calendar events for a day
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEventsForDate } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const refreshToken = jar.get("gcal_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ connected: false, events: [] });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();

  try {
    const events = await getEventsForDate(refreshToken, date);
    return NextResponse.json({ connected: true, events });
  } catch {
    return NextResponse.json({ connected: false, events: [], error: "token_expired" });
  }
}
