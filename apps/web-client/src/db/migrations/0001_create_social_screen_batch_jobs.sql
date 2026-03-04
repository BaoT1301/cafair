-- Path: apps/web-client/src/db/migrations/0001_create_social_screen_batch_jobs.sql

create extension if not exists "pgcrypto";

create table if not exists public.social_screen_batch_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_job_id text not null unique,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  total_candidates integer not null default 0,
  completed_candidates integer not null default 0,
  failed_candidates integer not null default 0,
  candidates_json jsonb not null default '[]'::jsonb,
  results_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_screen_batch_jobs_batch_job_id_idx
  on public.social_screen_batch_jobs (batch_job_id);

create index if not exists social_screen_batch_jobs_status_idx
  on public.social_screen_batch_jobs (status);

create index if not exists social_screen_batch_jobs_created_at_idx
  on public.social_screen_batch_jobs (created_at desc);