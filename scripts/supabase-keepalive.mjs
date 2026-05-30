/**
 * Supabase Keep-Alive
 * ────────────────────────────────────────────────────────────────────────
 * Makes one tiny read request against the Supabase REST API so the project
 * registers database activity. Free-tier Supabase projects are paused after
 * ~7 days of inactivity; running this on a schedule prevents that.
 *
 * Required environment variables:
 *   SUPABASE_URL              e.g. https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY service-role key (bypasses RLS for the read)
 *
 * No npm dependencies — uses Node 18+ built-in fetch.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Table to touch. `users` exists in this project's schema; change if needed.
const TABLE = process.env.SUPABASE_KEEPALIVE_TABLE ?? "users";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${TABLE}?select=id&limit=1`;

async function ping() {
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      // Ask PostgREST for just a count header — minimal payload.
      Prefer: "count=exact",
      Range: "0-0",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase responded ${res.status}: ${body}`);
  }

  const contentRange = res.headers.get("content-range") ?? "n/a";
  console.log(
    `[${new Date().toISOString()}] Keep-alive OK — ${TABLE} reachable (content-range: ${contentRange})`,
  );
}

ping().catch((err) => {
  console.error(`[${new Date().toISOString()}] Keep-alive FAILED:`, err.message);
  process.exit(1);
});
