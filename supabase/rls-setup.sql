-- ============================================================================
-- COMPLETE RLS SETUP FOR CAFAIR
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- This script is IDEMPOTENT — safe to run multiple times.
-- It creates public.get_user_id(), drops & recreates all RLS policies,
-- enables RLS on every table, and creates performance indexes.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. AUTH FUNCTION
-- ────────────────────────────────────────────────────────────────────────────
-- NOTE: Supabase locks the `auth` schema — we CANNOT create auth.user_id().
-- Instead we use public.get_user_id() as the canonical function.
-- The secure-client.ts sets `request.jwt.claims` via set_config(); this
-- function reads the Clerk JWT `sub` (or `user_id`) claim from it.

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('request.jwt.claims', true)::json->>'user_id'
  );
$$ LANGUAGE SQL STABLE;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. DROP ALL EXISTING PUBLIC POLICIES (clean slate)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. ENABLE RLS ON ALL TABLES
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE examples                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_actions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_screen_batch_jobs ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. USERS
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = public.get_user_id());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = public.get_user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 4. EXAMPLES
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY "examples_select_own" ON examples
  FOR SELECT USING (user_id = public.get_user_id() OR is_public = TRUE);

CREATE POLICY "examples_insert_own" ON examples
  FOR INSERT WITH CHECK (user_id = public.get_user_id());

CREATE POLICY "examples_update_own" ON examples
  FOR UPDATE USING (user_id = public.get_user_id());

CREATE POLICY "examples_delete_own" ON examples
  FOR DELETE USING (user_id = public.get_user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 5. EVENTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY "events_select_own" ON events
  FOR SELECT USING (user_id = public.get_user_id());

CREATE POLICY "events_insert_own" ON events
  FOR INSERT WITH CHECK (user_id = public.get_user_id());

CREATE POLICY "events_update_own" ON events
  FOR UPDATE USING (user_id = public.get_user_id());

CREATE POLICY "events_delete_own" ON events
  FOR DELETE USING (user_id = public.get_user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 6. JOB_ROLES
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY "job_roles_select_own" ON job_roles
  FOR SELECT USING (user_id = public.get_user_id());

CREATE POLICY "job_roles_insert_own" ON job_roles
  FOR INSERT WITH CHECK (user_id = public.get_user_id());

CREATE POLICY "job_roles_update_own" ON job_roles
  FOR UPDATE USING (user_id = public.get_user_id());

CREATE POLICY "job_roles_delete_own" ON job_roles
  FOR DELETE USING (user_id = public.get_user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 7. CANDIDATES  (user_id = creator, owner_id = assigned recruiter)
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY "candidates_select_own" ON candidates
  FOR SELECT USING (user_id = public.get_user_id() OR owner_id = public.get_user_id());

CREATE POLICY "candidates_insert_own" ON candidates
  FOR INSERT WITH CHECK (user_id = public.get_user_id());

CREATE POLICY "candidates_update_own" ON candidates
  FOR UPDATE USING (user_id = public.get_user_id() OR owner_id = public.get_user_id());

CREATE POLICY "candidates_delete_own" ON candidates
  FOR DELETE USING (user_id = public.get_user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 8. EVIDENCE  (no user_id — access derived via parent candidate)
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY "evidence_select_via_candidate" ON evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = evidence.candidate_id
        AND (c.user_id = public.get_user_id() OR c.owner_id = public.get_user_id())
    )
  );

CREATE POLICY "evidence_insert_via_candidate" ON evidence
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = evidence.candidate_id
        AND c.user_id = public.get_user_id()
    )
  );

CREATE POLICY "evidence_update_via_candidate" ON evidence
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = evidence.candidate_id
        AND (c.user_id = public.get_user_id() OR c.owner_id = public.get_user_id())
    )
  );

CREATE POLICY "evidence_delete_via_candidate" ON evidence
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = evidence.candidate_id
        AND c.user_id = public.get_user_id()
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 9. RECRUITER_ACTIONS
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY "recruiter_actions_select_own" ON recruiter_actions
  FOR SELECT USING (user_id = public.get_user_id());

CREATE POLICY "recruiter_actions_insert_own" ON recruiter_actions
  FOR INSERT WITH CHECK (user_id = public.get_user_id());

CREATE POLICY "recruiter_actions_update_own" ON recruiter_actions
  FOR UPDATE USING (user_id = public.get_user_id());

CREATE POLICY "recruiter_actions_delete_own" ON recruiter_actions
  FOR DELETE USING (user_id = public.get_user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 10. SOCIAL_SCREEN_BATCH_JOBS  (no user_id — allow all authenticated users)
-- ────────────────────────────────────────────────────────────────────────────
-- This table has no user_id column; any authenticated user can manage batch jobs.
CREATE POLICY "batch_jobs_select_authenticated" ON social_screen_batch_jobs
  FOR SELECT USING (public.get_user_id() IS NOT NULL);

CREATE POLICY "batch_jobs_insert_authenticated" ON social_screen_batch_jobs
  FOR INSERT WITH CHECK (public.get_user_id() IS NOT NULL);

CREATE POLICY "batch_jobs_update_authenticated" ON social_screen_batch_jobs
  FOR UPDATE USING (public.get_user_id() IS NOT NULL);

CREATE POLICY "batch_jobs_delete_authenticated" ON social_screen_batch_jobs
  FOR DELETE USING (public.get_user_id() IS NOT NULL);


-- ────────────────────────────────────────────────────────────────────────────
-- 11. PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email                    ON users(email);
CREATE INDEX IF NOT EXISTS idx_examples_user_id               ON examples(user_id);
CREATE INDEX IF NOT EXISTS idx_examples_is_public             ON examples(is_public);
CREATE INDEX IF NOT EXISTS idx_events_user_id                 ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_job_roles_user_id              ON job_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id             ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_owner_id            ON candidates(owner_id);
CREATE INDEX IF NOT EXISTS idx_evidence_candidate_id          ON evidence(candidate_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_actions_user_id      ON recruiter_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_actions_candidate_id ON recruiter_actions(candidate_id);


-- ════════════════════════════════════════════════════════════════════════════
-- DONE — verify with:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- ════════════════════════════════════════════════════════════════════════════
