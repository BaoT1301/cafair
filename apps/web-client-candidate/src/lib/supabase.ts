/**
 * Supabase Admin Client — Server-side only
 *
 * Uses the service-role key to bypass RLS for storage operations.
 * Auth is already handled by Clerk middleware — this client is only
 * used for trusted server operations (e.g. uploading to Storage).
 *
 * ⚠️ NEVER expose this client to the browser.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
  );
}

/**
 * Service-role Supabase client for server-side operations.
 * Has full access to Storage and bypasses RLS.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/** Bucket name for user-uploaded content */
export const USER_UPLOADS_BUCKET = "user-uploads";
