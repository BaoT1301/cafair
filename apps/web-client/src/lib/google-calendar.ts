import { google } from "googleapis";

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token every time
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  });
}

export async function getEventsForDate(refreshToken: string, date: Date) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: client });

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
  });

  return (res.data.items ?? []).map((ev) => ({
    id: ev.id ?? "",
    title: ev.summary ?? "(No title)",
    start: ev.start?.dateTime ?? ev.start?.date ?? "",
    end: ev.end?.dateTime ?? ev.end?.date ?? "",
    htmlLink: ev.htmlLink ?? "",
    attendees: (ev.attendees ?? []).map((a) => a.email ?? ""),
  }));
}

export async function createEvent(
  refreshToken: string,
  opts: {
    title: string;
    description?: string;
    startDateTime: string; // ISO
    endDateTime: string;   // ISO
    attendeeEmails?: string[];
    timeZone?: string;
  },
) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: client });
  const tz = opts.timeZone ?? "America/New_York";

  const res = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary: opts.title,
      description: opts.description,
      start: { dateTime: opts.startDateTime, timeZone: tz },
      end:   { dateTime: opts.endDateTime,   timeZone: tz },
      attendees: opts.attendeeEmails?.map((email) => ({ email })),
    },
  });

  return { id: res.data.id, htmlLink: res.data.htmlLink };
}
