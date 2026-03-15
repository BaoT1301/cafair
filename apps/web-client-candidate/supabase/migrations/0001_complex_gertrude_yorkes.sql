CREATE TABLE IF NOT EXISTS "social_screen_batch_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_job_id" text NOT NULL,
  "status" text NOT NULL,
  "total_candidates" integer DEFAULT 0 NOT NULL,
  "completed_candidates" integer DEFAULT 0 NOT NULL,
  "failed_candidates" integer DEFAULT 0 NOT NULL,
  "candidates_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "results_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_screen_batch_jobs_batch_job_id_unique"
  ON "social_screen_batch_jobs" USING btree ("batch_job_id");

CREATE INDEX IF NOT EXISTS "social_screen_batch_jobs_batch_job_id_idx"
  ON "social_screen_batch_jobs" USING btree ("batch_job_id");

CREATE INDEX IF NOT EXISTS "social_screen_batch_jobs_status_idx"
  ON "social_screen_batch_jobs" USING btree ("status");

CREATE INDEX IF NOT EXISTS "social_screen_batch_jobs_created_at_idx"
  ON "social_screen_batch_jobs" USING btree ("created_at");