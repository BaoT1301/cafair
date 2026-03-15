import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

try {
  // 1. Create public.get_user_id() function (works around auth schema restrictions)
  await sql.unsafe(`
    CREATE OR REPLACE FUNCTION public.get_user_id()
    RETURNS TEXT AS $$
      SELECT COALESCE(
        current_setting('request.jwt.claims', true)::json->>'sub',
        current_setting('request.jwt.claims', true)::json->>'user_id'
      );
    $$ LANGUAGE SQL STABLE;
  `);
  console.log("✓ public.get_user_id() function created");

  // Also try to create in auth schema - may fail on Supabase
  try {
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION auth.user_id()
      RETURNS TEXT AS $$
        SELECT public.get_user_id();
      $$ LANGUAGE SQL STABLE;
    `);
    console.log("✓ auth.user_id() function created (delegates to public.get_user_id)");
  } catch (e) {
    console.log("⚠ Could not create auth.user_id() (expected on Supabase):", e.message);
    console.log("  → Will use public.get_user_id() in RLS policies instead");
  }

  // 2. Check if auth.user_id works, otherwise use public.get_user_id
  let userIdFn = "auth.user_id()";
  try {
    await sql.unsafe(`SELECT auth.user_id()`);
    console.log("✓ auth.user_id() is callable");
  } catch {
    userIdFn = "public.get_user_id()";
    console.log("→ Using public.get_user_id() for RLS policies");
  }

  // 3. Drop existing policies (to recreate with correct function reference)
  const existingPolicies = await sql`SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'`;
  for (const p of existingPolicies) {
    await sql.unsafe(`DROP POLICY IF EXISTS "${p.policyname}" ON "${p.tablename}"`);
  }
  console.log(`✓ Dropped ${existingPolicies.length} existing policies`);

  // 4. Enable RLS on all tables
  const tables = ["users", "examples", "events", "job_roles", "candidates", "evidence", "recruiter_actions"];
  for (const t of tables) {
    await sql.unsafe(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
  }
  console.log("✓ RLS enabled on all tables");

  // 5. Create RLS policies using the available function
  const fn = userIdFn;
  const policies = [
    // USERS
    `CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = ${fn})`,
    `CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = ${fn})`,

    // EXAMPLES
    `CREATE POLICY "examples_select_own" ON examples FOR SELECT USING (user_id = ${fn} OR is_public = TRUE)`,
    `CREATE POLICY "examples_insert_own" ON examples FOR INSERT WITH CHECK (user_id = ${fn})`,
    `CREATE POLICY "examples_update_own" ON examples FOR UPDATE USING (user_id = ${fn})`,
    `CREATE POLICY "examples_delete_own" ON examples FOR DELETE USING (user_id = ${fn})`,

    // EVENTS
    `CREATE POLICY "events_select_own" ON events FOR SELECT USING (user_id = ${fn})`,
    `CREATE POLICY "events_insert_own" ON events FOR INSERT WITH CHECK (user_id = ${fn})`,
    `CREATE POLICY "events_update_own" ON events FOR UPDATE USING (user_id = ${fn})`,
    `CREATE POLICY "events_delete_own" ON events FOR DELETE USING (user_id = ${fn})`,

    // JOB_ROLES
    `CREATE POLICY "job_roles_select_own" ON job_roles FOR SELECT USING (user_id = ${fn})`,
    `CREATE POLICY "job_roles_insert_own" ON job_roles FOR INSERT WITH CHECK (user_id = ${fn})`,
    `CREATE POLICY "job_roles_update_own" ON job_roles FOR UPDATE USING (user_id = ${fn})`,
    `CREATE POLICY "job_roles_delete_own" ON job_roles FOR DELETE USING (user_id = ${fn})`,

    // CANDIDATES
    `CREATE POLICY "candidates_select_own" ON candidates FOR SELECT USING (user_id = ${fn} OR owner_id = ${fn})`,
    `CREATE POLICY "candidates_insert_own" ON candidates FOR INSERT WITH CHECK (user_id = ${fn})`,
    `CREATE POLICY "candidates_update_own" ON candidates FOR UPDATE USING (user_id = ${fn} OR owner_id = ${fn})`,
    `CREATE POLICY "candidates_delete_own" ON candidates FOR DELETE USING (user_id = ${fn})`,

    // EVIDENCE (via candidates join)
    `CREATE POLICY "evidence_select_via_candidate" ON evidence FOR SELECT USING (EXISTS (SELECT 1 FROM candidates c WHERE c.id = evidence.candidate_id AND (c.user_id = ${fn} OR c.owner_id = ${fn})))`,
    `CREATE POLICY "evidence_insert_via_candidate" ON evidence FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM candidates c WHERE c.id = evidence.candidate_id AND c.user_id = ${fn}))`,
    `CREATE POLICY "evidence_update_via_candidate" ON evidence FOR UPDATE USING (EXISTS (SELECT 1 FROM candidates c WHERE c.id = evidence.candidate_id AND (c.user_id = ${fn} OR c.owner_id = ${fn})))`,
    `CREATE POLICY "evidence_delete_via_candidate" ON evidence FOR DELETE USING (EXISTS (SELECT 1 FROM candidates c WHERE c.id = evidence.candidate_id AND c.user_id = ${fn}))`,

    // RECRUITER_ACTIONS
    `CREATE POLICY "recruiter_actions_select_own" ON recruiter_actions FOR SELECT USING (user_id = ${fn})`,
    `CREATE POLICY "recruiter_actions_insert_own" ON recruiter_actions FOR INSERT WITH CHECK (user_id = ${fn})`,
    `CREATE POLICY "recruiter_actions_update_own" ON recruiter_actions FOR UPDATE USING (user_id = ${fn})`,
    `CREATE POLICY "recruiter_actions_delete_own" ON recruiter_actions FOR DELETE USING (user_id = ${fn})`,
  ];

  for (const p of policies) {
    await sql.unsafe(p);
  }
  console.log(`✓ Created ${policies.length} RLS policies`);

  // 6. Create indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_job_roles_user_id ON job_roles(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_candidates_owner_id ON candidates(owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_evidence_candidate_id ON evidence(candidate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_recruiter_actions_user_id ON recruiter_actions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_recruiter_actions_candidate_id ON recruiter_actions(candidate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_examples_user_id ON examples(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_examples_is_public ON examples(is_public)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  ];

  for (const idx of indexes) {
    await sql.unsafe(idx);
  }
  console.log(`✓ Created ${indexes.length} indexes`);

  // 7. Verify
  const finalPolicies = await sql`SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`;
  console.log(`\n✓ Total RLS policies: ${finalPolicies.length}`);
  for (const p of finalPolicies) {
    console.log(`  ${p.tablename}: ${p.policyname}`);
  }

  await sql.end();
  console.log("\n✅ Database setup complete!");
} catch (e) {
  console.error("Error:", e.message);
  await sql.end();
  process.exit(1);
}
