// GET /api/google-calendar — redirect user to Google OAuth consent screen
import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
