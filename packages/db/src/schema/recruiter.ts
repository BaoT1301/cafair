import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── Events ───────────────────────────────────────────────
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  date: timestamp("date", { withTimezone: true }),
  location: text("location"),
  status: text("status").default("pre"), // pre | live | ended
  recruiterCount: integer("recruiter_count").default(0),
  candidateCount: integer("candidate_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Job Roles ────────────────────────────────────────────
export const jobRoles = pgTable("job_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  eventId: uuid("event_id").references(() => events.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  reqId: text("req_id"),
  department: text("department"),
  targetHires: integer("target_hires").default(1),
  offersNeeded: integer("offers_needed").default(1),
  offersSent: integer("offers_sent").default(0),
  offersAccepted: integer("offers_accepted").default(0),
  status: text("status").default("on_track"), // on_track | at_risk | critical
  mustHaveSkills: text("must_have_skills").array(),
  niceToHaveSkills: text("nice_to_have_skills").array(),
  jobDescription: text("job_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Candidates ───────────────────────────────────────────
export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  eventId: uuid("event_id").references(() => events.id, {
    onDelete: "cascade",
  }),
  roleId: uuid("role_id").references(() => jobRoles.id),

  // Identity
  name: text("name").notNull(),
  email: text("email"),
  school: text("school"),
  role: text("role"), // the role they're applying for (display)
  avatarUrl: text("avatar_url"),
  verified: boolean("verified").default(false),

  // Scoring
  fitScore: integer("fit_score").default(0), // 0-100
  riskLevel: text("risk_level").default("low"), // low | medium | high

  // Pipeline
  stage: text("stage").default("fair"), // fair | screen | interview | offer | day1
  lane: text("lane").default("quick_screen"), // recruiter_now | quick_screen | redirect

  // AI Analysis
  strengths: text("strengths").array(),
  gaps: text("gaps").array(),
  summary: text("summary"),

  // Meta
  ownerId: text("owner_id"), // recruiter Clerk user ID
  lastTouch: timestamp("last_touch", { withTimezone: true }),
  nextAction: text("next_action"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Evidence ─────────────────────────────────────────────
export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // resume | essay | code | screen
  url: text("url"),
  content: text("content"), // raw text if no URL
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Recruiter Actions (ATS Sync queue) ───────────────────
export const recruiterActions = pgTable("recruiter_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  candidateId: uuid("candidate_id").references(() => candidates.id, {
    onDelete: "cascade",
  }),
  actionType: text("action_type").notNull(), // sync_to_ats | follow_up_email | schedule_interview | move_stage
  status: text("status").default("queued"), // queued | agent_active | needs_approval | success | failed
  approvedBy: text("approved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
