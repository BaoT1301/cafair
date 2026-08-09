"use client";

/**
 * My Application — the candidate's home.
 *
 * The product thesis in one page: a candidate should never have to wonder
 * where they stand. Everything here answers "what is happening to my
 * application right now", which is the question the resume black hole leaves
 * unanswered.
 */

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowUpRight, Sparkles, FileText, MapPin } from "lucide-react";
import {
  PageShell,
  Card,
  CardTitle,
  CardSub,
  Badge,
  ScoreRing,
  PrimaryButton,
  Meter,
  fadeUp,
  BRAND_2,
  LIME,
} from "@/components/candidate/ui";

const STAGE_LABELS: Record<string, string> = {
  fair: "Applied",
  screen: "Screening",
  interview: "Interview",
  offer: "Offer",
  day1: "Hired",
};

export default function CandidateHomePage() {
  const trpc = useTRPC();
  const { data: profile, isLoading } = useQuery(trpc.candidate.getMyProfile.queryOptions());
  const { data: timeline } = useQuery(trpc.candidate.getMyTimeline.queryOptions());
  const { data: event } = useQuery(trpc.candidate.getActiveEvent.queryOptions());
  const { data: matches } = useQuery(trpc.candidate.getMyMatches.queryOptions());

  const topMatch = matches?.[0];

  return (
    <PageShell
      title={profile ? `Hi, ${profile.name.split(" ")[0]}` : "My Application"}
      subtitle="Where you stand, and what happens next."
      action={
        event ? (
          <Link href="/candidate/fair">
            <Badge tone="brand">{event.name} is live</Badge>
          </Link>
        ) : undefined
      }
    >
      {isLoading && (
        <div className="bg-white rounded-[16px] p-[25px] animate-pulse flex flex-col gap-4">
          <div className="h-6 bg-[#e2e8e5] rounded w-1/3" />
          <div className="h-2 bg-[#e2e8e5] rounded-full w-full" />
          <div className="h-2 bg-[#e2e8e5] rounded-full w-2/3" />
        </div>
      )}

      {profile && (
        <>
          {/* ── Status timeline ─────────────────────────────────── */}
          <Card>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-1 min-w-0">
                <CardTitle>{profile.stageLabel}</CardTitle>
                <CardSub>{profile.stageBlurb}</CardSub>
              </div>
              {profile.role && <Badge tone="neutral" dot={false}>{profile.role}</Badge>}
            </div>

            {/* Stage rail */}
            <div className="flex items-center gap-0 mt-3 w-full">
              {timeline?.map((t, i) => (
                <div key={t.stage} className="flex items-center flex-1 last:flex-none min-w-0">
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: t.reached ? BRAND_2 : "#e2e8e5",
                        boxShadow: t.current ? "0 0 0 4px #e8f5ee" : undefined,
                      }}
                    >
                      {t.reached ? (
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      ) : (
                        <span className="text-[11px] font-semibold text-[#9ca3af]">{i + 1}</span>
                      )}
                    </motion.div>
                    <span
                      className={`text-[11px] whitespace-nowrap ${
                        t.current
                          ? "font-semibold text-[#0e3d27]"
                          : t.reached
                            ? "font-medium text-[#4b5563]"
                            : "font-normal text-[#9ca3af]"
                      }`}
                    >
                      {STAGE_LABELS[t.stage]}
                    </span>
                  </div>
                  {i < (timeline?.length ?? 0) - 1 && (
                    <div className="flex-1 h-[3px] mx-1 rounded-full mb-6 min-w-[12px]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          background: timeline[i + 1].reached ? BRAND_2 : "#e2e8e5",
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* ── Assessment + next step ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp} className="lg:col-span-2">
              <Card className="h-full">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <CardTitle>Your assessment</CardTitle>
                    <CardSub>
                      {profile.scored
                        ? "Generated by the same engine recruiters see."
                        : "Add your resume and we'll score it in seconds."}
                    </CardSub>
                  </div>
                </div>

                {profile.scored ? (
                  <div className="flex items-center gap-7 flex-wrap mt-1">
                    <ScoreRing score={profile.fitScore} label="fit score" />
                    <div className="flex flex-col gap-3 flex-1 min-w-[220px]">
                      {profile.strengths.slice(0, 3).map((s) => (
                        <div key={s} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1f6b43] mt-[7px] shrink-0" />
                          <span className="text-[14px] text-[#111827] leading-5">{s}</span>
                        </div>
                      ))}
                      {profile.strengths.length === 0 && (
                        <p className="text-[14px] text-[#6b7280]">
                          No strengths recorded yet.
                        </p>
                      )}
                      <Link
                        href="/candidate/feedback"
                        className="text-[14px] font-semibold text-[#0e3d27] underline mt-1"
                      >
                        See the full breakdown →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-4 py-4">
                    <div className="w-12 h-12 rounded-full bg-[#e8f5ee] flex items-center justify-center">
                      <FileText className="w-6 h-6 text-[#1f6b43]" />
                    </div>
                    <p className="text-[14px] text-[#4b5563] max-w-md leading-5">
                      You haven&apos;t been scored yet. Paste your resume and our AI will
                      assess it against the open roles — you&apos;ll see exactly what it
                      found, strengths and gaps both.
                    </p>
                    <Link href="/candidate/profile">
                      <PrimaryButton>
                        <Sparkles className="w-4 h-4" />
                        Get assessed
                      </PrimaryButton>
                    </Link>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Top match */}
            <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
              <div
                className="rounded-[16px] p-[25px] flex flex-col gap-4 h-full"
                style={{ background: "linear-gradient(-6.89deg, #1f6b43 9.75%, #0e3d27 73.23%)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-white tracking-[-0.076px]">
                    Best role match
                  </span>
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#0e3d27]" />
                  </div>
                </div>

                {topMatch ? (
                  <>
                    <span className="text-[24px] font-bold text-white leading-8">
                      {topMatch.role.title}
                    </span>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-white/70">Match</span>
                        <span className="text-[12px] font-semibold" style={{ color: LIME }}>
                          {topMatch.score}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: LIME }}
                          initial={{ width: 0 }}
                          animate={{ width: `${topMatch.score}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>
                    <Link
                      href="/candidate/matches"
                      className="text-[13px] font-semibold underline mt-auto"
                      style={{ color: LIME }}
                    >
                      View all matches →
                    </Link>
                  </>
                ) : (
                  <p className="text-[14px] text-white/70 leading-5">
                    No open roles published yet. Check back once the fair opens.
                  </p>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Event strip ─────────────────────────────────────── */}
          {event && (
            <motion.div initial="hidden" animate="visible" custom={4} variants={fadeUp}>
              <Card className="flex-row items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[#e8f5ee] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-[#1f6b43]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-semibold text-[#111827] tracking-[-0.234px] truncate">
                      {event.name}
                    </span>
                    <span className="text-[13px] text-[#6b7280] truncate">
                      {event.location ?? "Location TBA"}
                      {event.recruiterCount > 0 && ` · ${event.recruiterCount} recruiters on the floor`}
                    </span>
                  </div>
                </div>
                <Link href="/candidate/fair">
                  <PrimaryButton>
                    {profile.checkedInAt ? "View fair" : "Check in"}
                  </PrimaryButton>
                </Link>
              </Card>
            </motion.div>
          )}

          {/* ── Progress hint ───────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" custom={5} variants={fadeUp}>
            <Card>
              <CardTitle>Profile completeness</CardTitle>
              <CardSub>A fuller profile scores more accurately.</CardSub>
              {(() => {
                const checks = [
                  { label: "Name", done: Boolean(profile.name) },
                  { label: "School", done: Boolean(profile.school) },
                  { label: "Target role", done: Boolean(profile.role) },
                  { label: "Resume submitted", done: profile.scored },
                ];
                const done = checks.filter((c) => c.done).length;
                const pct = Math.round((done / checks.length) * 100);
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <Meter value={pct} />
                      <span className="text-[13px] font-semibold text-[#111827] tabular-nums shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {checks.map((c) => (
                        <span
                          key={c.label}
                          className={`text-[12px] px-2.5 py-1 rounded-[6px] ${
                            c.done
                              ? "bg-[#e8f5ee] text-[#1f6b43] font-medium"
                              : "bg-[#f7f7f7] text-[#9ca3af]"
                          }`}
                        >
                          {c.done ? "✓ " : ""}
                          {c.label}
                        </span>
                      ))}
                    </div>
                    {done < checks.length && (
                      <Link
                        href="/candidate/profile"
                        className="text-[14px] font-semibold text-[#0e3d27] underline mt-1 self-start"
                      >
                        Complete your profile →
                      </Link>
                    )}
                  </>
                );
              })()}
            </Card>
          </motion.div>
        </>
      )}
    </PageShell>
  );
}
