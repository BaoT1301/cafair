"use client";

/**
 * Career Fair — day-of check-in.
 *
 * Mirrors the established career-fair app pattern (pre-event employer
 * discovery, day-of check-in, per-role notes) and ties into the recruiter
 * side's Live Fair: checking in stamps `candidates.checked_in_at`, which is
 * what the recruiter's live view reads.
 */

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, MapPin, Users, CheckCircle2, Loader2, Target } from "lucide-react";
import {
  PageShell,
  Card,
  CardTitle,
  CardSub,
  Badge,
  PrimaryButton,
  Toast,
  Empty,
  Meter,
  fadeUp,
  BRAND_2,
  LIME,
} from "@/components/candidate/ui";

export default function CandidateFairPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery(trpc.candidate.getActiveEvent.queryOptions());
  const { data: profile } = useQuery(trpc.candidate.getMyProfile.queryOptions());
  const { data: matches } = useQuery(trpc.candidate.getMyMatches.queryOptions());
  const [toast, setToast] = useState<string | null>(null);

  const checkIn = useMutation(
    trpc.candidate.checkIn.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.candidate.getMyProfile.queryOptions().queryKey });
        setToast("You're checked in — recruiters can see you're here");
      },
      onError: (e) => setToast(e.message),
    }),
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const checkedIn = Boolean(profile?.checkedInAt);
  const topRoles = matches?.slice(0, 3) ?? [];

  return (
    <PageShell
      title="Career Fair"
      subtitle="Check in when you arrive so recruiters know you're on the floor."
    >
      {isLoading && <div className="bg-white rounded-[16px] p-[25px] animate-pulse h-40" />}

      {!isLoading && !event && (
        <Empty
          icon={CalendarDays}
          title="No live event right now"
          body="When a career fair goes live, you'll be able to check in here and see which recruiters are on the floor."
        />
      )}

      {event && (
        <>
          {/* ── Event hero ──────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
            <div
              className="rounded-[16px] p-[25px] flex flex-col gap-5"
              style={{ background: "linear-gradient(-6.89deg, #1f6b43 9.75%, #0e3d27 73.23%)" }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ background: LIME }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-2 w-2"
                        style={{ background: LIME }}
                      />
                    </span>
                    <span
                      className="text-[11px] font-bold tracking-[0.117px] uppercase"
                      style={{ color: LIME }}
                    >
                      Live now
                    </span>
                  </div>
                  <h2 className="text-[28px] font-bold text-white leading-9 tracking-[-0.045em]">
                    {event.name}
                  </h2>
                  <div className="flex items-center gap-4 flex-wrap text-white/70 text-[13px]">
                    {event.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.location}
                      </span>
                    )}
                    {event.date && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {new Date(event.date).toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {event.recruiterCount > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {event.recruiterCount} recruiters
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {checkedIn ? (
                    <div className="flex items-center gap-2 bg-white/15 rounded-[14px] px-4 py-2.5">
                      <CheckCircle2 className="w-4 h-4" style={{ color: LIME }} />
                      <span className="text-[14px] font-semibold text-white">
                        Checked in
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => checkIn.mutate()}
                      disabled={checkIn.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-[14px] px-6 py-3 text-[14px] font-semibold text-[#0e3d27] bg-white transition-all duration-150 active:scale-[0.97] hover:brightness-95 disabled:opacity-60"
                    >
                      {checkIn.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      Check in
                    </button>
                  )}
                </div>
              </div>

              {checkedIn && profile?.checkedInAt && (
                <span className="text-[12px] text-white/60">
                  Arrived at{" "}
                  {new Date(profile.checkedInAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </motion.div>

          {/* ── Readiness ───────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
            <Card>
              <CardTitle>Before you walk up to a booth</CardTitle>
              <CardSub>
                Recruiters can pull up your profile instantly. Make sure it says what
                you want it to.
              </CardSub>

              {(() => {
                const steps = [
                  {
                    label: "Profile filled in",
                    done: Boolean(profile?.name && profile?.school),
                    href: "/candidate/profile",
                  },
                  {
                    label: "Resume submitted & scored",
                    done: Boolean(profile?.scored),
                    href: "/candidate/profile",
                  },
                  {
                    label: "Checked in at the fair",
                    done: checkedIn,
                    href: "/candidate/fair",
                  },
                ];
                const done = steps.filter((s) => s.done).length;
                const pct = Math.round((done / steps.length) * 100);

                return (
                  <>
                    <div className="flex items-center gap-3">
                      <Meter value={pct} />
                      <span className="text-[13px] font-semibold text-[#111827] tabular-nums shrink-0">
                        {done}/{steps.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 mt-1">
                      {steps.map((s) => (
                        <Link
                          key={s.label}
                          href={s.href}
                          className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[#f7f7f7]"
                        >
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: s.done ? BRAND_2 : "#e2e8e5" }}
                          >
                            {s.done && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                            )}
                          </div>
                          <span
                            className={`text-[14px] ${
                              s.done
                                ? "text-[#4b5563] line-through decoration-[#9ca3af]"
                                : "text-[#111827] font-medium"
                            }`}
                          >
                            {s.label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </>
                );
              })()}
            </Card>
          </motion.div>

          {/* ── Roles to target ─────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
            <Card>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <CardTitle>Ask about these roles</CardTitle>
                  <CardSub>Your three strongest matches at this event.</CardSub>
                </div>
                <Link href="/candidate/matches">
                  <Badge tone="neutral" dot={false}>See all</Badge>
                </Link>
              </div>

              {topRoles.length > 0 ? (
                <div className="flex flex-col gap-3 mt-1">
                  {topRoles.map((m) => (
                    <div
                      key={m.role.id}
                      className="flex items-center gap-4 rounded-[14px] border border-[#e2e8e5] px-4 py-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#e8f5ee] flex items-center justify-center shrink-0">
                        <Target className="w-4 h-4 text-[#1f6b43]" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[14px] font-semibold text-[#111827] truncate">
                          {m.role.title}
                        </span>
                        <span className="text-[12px] text-[#6b7280] truncate">
                          {m.role.department ?? "General"}
                          {m.matched.length > 0 && ` · you have ${m.matched.slice(0, 2).join(", ")}`}
                        </span>
                      </div>
                      <span className="text-[16px] font-bold text-[#0e3d27] tabular-nums shrink-0">
                        {m.score}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#9ca3af]">
                  No roles published for this event yet.
                </p>
              )}
            </Card>
          </motion.div>
        </>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </PageShell>
  );
}
