// GET /api/google-calendar/callback — OAuth2 callback, stores tokens in HTTP-only cookies
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createOAuth2Client } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const base = new URL(req.url).origin;

  if (error || !code) {
    return NextResponse.redirect(`${base}/recruiter/settings?gcal=error`);
  }

  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);

    const jar = await cookies();

    // Store refresh token long-term (only present on first authorization or re-consent)
    if (tokens.refresh_token) {
      jar.set("gcal_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    // Store access token short-term for immediate use
    if (tokens.access_token) {
      jar.set("gcal_access_token", tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 3600,
      });
    }

    return NextResponse.redirect(`${base}/hiring-center?gcal=connected`);
  } catch {
    return NextResponse.redirect(`${base}/recruiter/settings?gcal=error`);
  }
}
