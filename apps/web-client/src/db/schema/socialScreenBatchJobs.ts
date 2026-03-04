// Path: apps/web-client/src/db/schema/socialScreenBatchJobs.ts

import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  SocialScreenBatchCandidate,
  SocialScreenBatchCandidateResult,
  SocialScreenBatchStatus,
} from "@/lib/aihire/socialScreenBatchTypes";

export const socialScreenBatchJobs = pgTable(
  "social_screen_batch_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    batchJobId: text("batch_job_id").notNull(),

    status: text("status")
      .$type<SocialScreenBatchStatus>()
      .notNull(),

    totalCandidates: integer("total_candidates").notNull().default(0),
    completedCandidates: integer("completed_candidates").notNull().default(0),
    failedCandidates: integer("failed_candidates").notNull().default(0),

    candidatesJson: jsonb("candidates_json")
      .$type<SocialScreenBatchCandidate[]>()
      .notNull()
      .default([]),

    resultsJson: jsonb("results_json")
      .$type<SocialScreenBatchCandidateResult[]>()
      .notNull()
      .default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    batchJobIdUnique: uniqueIndex(
      "social_screen_batch_jobs_batch_job_id_unique",
    ).on(table.batchJobId),
    batchJobIdIdx: index(
      "social_screen_batch_jobs_batch_job_id_idx",
    ).on(table.batchJobId),
    statusIdx: index(
      "social_screen_batch_jobs_status_idx",
    ).on(table.status),
    createdAtIdx: index(
      "social_screen_batch_jobs_created_at_idx",
    ).on(table.createdAt),
  }),
);

export type SocialScreenBatchJobRow =
  typeof socialScreenBatchJobs.$inferSelect;

export type NewSocialScreenBatchJobRow =
  typeof socialScreenBatchJobs.$inferInsert;