"use client";

/**
 * Role Matches.
 *
 * Every score here is explainable: the candidate sees exactly which required
 * skills matched and which are missing. That is a deliberate choice over an
 * opaque model score — a person told "you're a 62% match" with no reason
 * cannot act on it, and cannot meaningfully contest it either.
 */

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Check, X } from "lucide-react";
import {
  PageShell,
  Card,
  CardTitle,
  CardSub,
  Badge,
  Tag,
  Meter,
  Empty,
  CardSkeleton,
  fadeUp,
  BRAND_2,
} from "@/components/candidate/ui";

function toneForScore(score: number): "brand" | "amber" | "neutral" {
  if (score >= 70) return "brand";
  if (score >= 40) return "amber";
  return "neutral";
}

function labelForScore(score: number) {
  if (score >= 70) return "Strong match";
  if (score >= 40) return "Partial match";
  return "Stretch";
}

export default function CandidateMatchesPage() {
  const trpc = useTRPC();
  const { data: matches, isLoading } = useQuery(trpc.candidate.getMyMatches.queryOptions());
  const { data: profile } = useQuery(trpc.candidate.getMyProfile.queryOptions());
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <PageShell
      title="Role Matches"
      subtitle="Open roles ranked against your profile — and why."
    >
      {isLoading && <CardSkeleton count={3} />}

      {!isLoading && (!matches || matches.length === 0) && (
        <Empty
          icon={Target}
          title="No open roles yet"
          body="Once employers publish roles for this fair, you'll see how you match against each one."
        />
      )}

      {!isLoading && !profile?.scored && matches && matches.length > 0 && (
        <div className="bg-[#fef3c7] text-[#92400e] rounded-[14px] px-[17px] py-[13px] text-[14px] leading-5 tracking-[-0.015em]">
          These matches use only your profile so far. Submit a resume to get a
          much more accurate ranking.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {matches?.map((m, i) => {
          const isOpen = expanded === m.role.id;
          return (
            <motion.div
              key={m.role.id}
              initial="hidden"
              animate="visible"
              custom={i}
              variants={fadeUp}
            >
              <Card>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle>{m.role.title}</CardTitle>
                      {m.applied && <Tag filled>Applied</Tag>}
                    </div>
                    <CardSub>{m.role.department ?? "General"}</CardSub>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge tone={toneForScore(m.score)}>{labelForScore(m.score)}</Badge>
                    <span className="text-[24px] font-bold text-[#111827] tabular-nums leading-none">
                      {m.score}
                      <span className="text-[13px] font-medium text-[#9ca3af]">%</span>
                    </span>
                  </div>
                </div>

                <Meter value={m.score} color={BRAND_2} />

                {/* Matched / missing skills */}
                {(m.matched.length > 0 || m.missing.length > 0) && (
                  <div className="flex flex-col gap-3 mt-1">
                    {m.matched.length > 0 && (
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-[#1f6b43] mt-[3px] shrink-0">
                          You have
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {m.matched.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#e8f5ee] text-[#1f6b43] px-2 py-[3px] rounded-[6px]"
                            >
                              <Check className="w-3 h-3" strokeWidth={3} />
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {m.missing.length > 0 && (
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-[#92400e] mt-[3px] shrink-0">
                          Missing
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {m.missing.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#fef3c7] text-[#92400e] px-2 py-[3px] rounded-[6px]"
                            >
                              <X className="w-3 h-3" strokeWidth={3} />
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {m.role.jobDescription && (
                  <>
                    <button
                      onClick={() => setExpanded(isOpen ? null : m.role.id)}
                      className="text-[14px] font-semibold text-[#0e3d27] underline self-start transition-all active:scale-[0.97]"
                    >
                      {isOpen ? "Hide description" : "Read the full description →"}
                    </button>
                    {isOpen && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-[14px] text-[#4b5563] leading-6 whitespace-pre-wrap border-t border-[#e2e8e5] pt-4"
                      >
                        {m.role.jobDescription}
                      </motion.p>
                    )}
                  </>
                )}

                {m.role.mustHaveSkills.length === 0 &&
                  m.role.niceToHaveSkills.length === 0 && (
                    <p className="text-[12px] text-[#9ca3af]">
                      This role hasn&apos;t published a skills rubric, so the score falls
                      back to your overall fit.
                    </p>
                  )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </PageShell>
  );
}
