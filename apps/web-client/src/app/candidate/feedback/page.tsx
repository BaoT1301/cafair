"use client";

/**
 * AI Feedback — the transparency layer.
 *
 * This page exists because 53.5% of candidates report receiving no feedback
 * after screening, and because the EU AI Act's high-risk hiring rules (in
 * force 2026-08-02) give a person assessed by an automated tool the right to
 * an explanation of the main elements of the decision.
 *
 * Everything shown is the candidate's OWN assessment, pulled straight from the
 * fields recruiters see. Internal judgements — risk level, routing lane — are
 * excluded at the projection layer and never reach this component. See
 * `services/candidate/view.ts`.
 */

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Target, Info, ShieldCheck } from "lucide-react";
import {
  PageShell,
  Card,
  CardTitle,
  CardSub,
  ScoreRing,
  PrimaryButton,
  Empty,
  fadeUp,
} from "@/components/candidate/ui";

export default function CandidateFeedbackPage() {
  const trpc = useTRPC();
  const { data: profile, isLoading } = useQuery(trpc.candidate.getMyProfile.queryOptions());

  if (!isLoading && profile && !profile.scored) {
    return (
      <PageShell title="AI Feedback" subtitle="Your assessment, explained in full.">
        <Empty
          icon={Sparkles}
          title="No assessment yet"
          body="Once you submit a resume, this page shows exactly what the AI found — the score, what it counted as strengths, and where it saw gaps."
          action={
            <Link href="/candidate/profile">
              <PrimaryButton>
                <Sparkles className="w-4 h-4" />
                Submit your resume
              </PrimaryButton>
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="AI Feedback" subtitle="Your assessment, explained in full.">
      {isLoading && (
        <div className="bg-white rounded-[16px] p-[25px] animate-pulse h-48" />
      )}

      {profile?.scored && (
        <>
          {/* ── Headline score ──────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
            <Card>
              <div className="flex items-start gap-8 flex-wrap">
                <ScoreRing score={profile.fitScore} size={148} label="fit score" />
                <div className="flex flex-col gap-3 flex-1 min-w-[260px]">
                  <CardTitle>What this means</CardTitle>
                  <p className="text-[14px] text-[#4b5563] leading-6">
                    {profile.summary ??
                      "Your resume was assessed against the role requirements. The strengths and gaps below are the specific signals the model picked up."}
                  </p>
                  <div className="flex items-center gap-2 text-[12px] text-[#6b7280] mt-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      This is the same score recruiters see. It is one input to a
                      human decision, not the decision itself.
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* ── Strengths / gaps ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
              <Card className="h-full">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#e8f5ee] flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4.5 h-4.5 text-[#1f6b43]" />
                  </div>
                  <CardTitle>What stood out</CardTitle>
                </div>
                {profile.strengths.length > 0 ? (
                  <div className="flex flex-col gap-3 mt-1">
                    {profile.strengths.map((s, i) => (
                      <motion.div
                        key={s}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-start gap-3 bg-[#e8f5ee] rounded-[14px] px-4 py-3"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1f6b43] mt-[7px] shrink-0" />
                        <span className="text-[14px] text-[#0e3d27] leading-5">{s}</span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <CardSub>No specific strengths were recorded.</CardSub>
                )}
              </Card>
            </motion.div>

            <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
              <Card className="h-full">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#fef3c7] flex items-center justify-center shrink-0">
                    <Target className="w-4.5 h-4.5 text-[#92400e]" />
                  </div>
                  <CardTitle>Where to grow</CardTitle>
                </div>
                {profile.gaps.length > 0 ? (
                  <div className="flex flex-col gap-3 mt-1">
                    {profile.gaps.map((g, i) => (
                      <motion.div
                        key={g}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-start gap-3 bg-[#fef3c7] rounded-[14px] px-4 py-3"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#92400e] mt-[7px] shrink-0" />
                        <span className="text-[14px] text-[#92400e] leading-5">{g}</span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <CardSub>No gaps were flagged.</CardSub>
                )}
              </Card>
            </motion.div>
          </div>

          {/* ── Disclosure ──────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
            <Card>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#f7f7f7] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4.5 h-4.5 text-[#4b5563]" />
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                  <CardTitle>How you were assessed</CardTitle>
                  <p className="text-[14px] text-[#4b5563] leading-6">
                    An automated system read the resume you submitted and compared it
                    against the requirements published for the role. It produced the
                    score, strengths and gaps on this page. A recruiter reviews that
                    output alongside your full profile — the system does not reject
                    candidates on its own.
                  </p>
                  <p className="text-[13px] text-[#6b7280] leading-5">
                    You can update your resume at any time to be re-assessed. If you
                    believe the assessment is wrong, the recruiting team can override
                    it manually.
                  </p>
                  <Link
                    href="/candidate/profile"
                    className="text-[14px] font-semibold text-[#0e3d27] underline self-start mt-1"
                  >
                    Resubmit your resume →
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </PageShell>
  );
}
