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
 * Optional:
 *   SUPABASE_KEEPALIVE_TABLE  override the first table tried
 *
 * No npm dependencies — uses Node 18+ built-in fetch.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Tables are tried in order. Several are listed so that renaming or dropping
// one table doesn't silently turn the keep-alive into a daily 404 — the whole
// point is that this never fails quietly.
const TABLES = [
  process.env.SUPABASE_KEEPALIVE_TABLE,
  "users",
  "candidates",
  "events",
].filter(Boolean);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const BASE = SUPABASE_URL.replace(/\/$/, "");

async function pingTable(table) {
  const res = await fetch(`${BASE}/rest/v1/${table}?select=*&limit=1`, {
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
    throw new Error(`${res.status} ${await res.text()}`);
  }

  return res.headers.get("content-range") ?? "n/a";
}

async function ping() {
  const failures = [];

  for (const table of TABLES) {
    try {
      const contentRange = await pingTable(table);
      console.log(
        `[${new Date().toISOString()}] Keep-alive OK — ${table} reachable (content-range: ${contentRange})`,
      );
      return;
    } catch (err) {
      failures.push(`${table}: ${err.message}`);
    }
  }

  throw new Error(`No table could be read.\n  ${failures.join("\n  ")}`);
}

ping().catch((err) => {
  console.error(`[${new Date().toISOString()}] Keep-alive FAILED:`, err.message);
  process.exit(1);
});
