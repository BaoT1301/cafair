"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */
type CandidateData = {
  id: string;
  name: string;
  fitScore: number | null;
  riskLevel: string | null;
  stage: string | null;
  strengths: string[] | unknown;
  gaps: string[] | unknown;
  summary: string | null;
  school: string | null;
  role: string | null;
};

function getStrengths(c: CandidateData): string[] {
  return Array.isArray(c.strengths) ? (c.strengths as string[]) : [];
}
function getGaps(c: CandidateData): string[] {
  return Array.isArray(c.gaps) ? (c.gaps as string[]) : [];
}

/* ─── Derived mock helpers ───────────────────────────────────── */
function getSalary(score: number): string {
  return `$${Math.round(150 + score * 0.7)}k`;
}
function getMarketMedian(): string {
  return "$210k";
}
function getCompGap(score: number): string {
  const expected = 150 + score * 0.7;
  const market = 210;
  const pct = Math.round(((expected - market) / market) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}
function getOfferProb(score: number): number {
  return Math.min(85, Math.round(50 + score * 0.35));
}
function getInterviewScore(score: number): string {
  return (7 + score * 0.025).toFixed(1);
}
function getStartAvailability(score: number): string {
  if (score >= 90) return "2 weeks";
  if (score >= 80) return "1 month";
  return "Immediate";
}
function getCompetingOffers(riskLevel: string | null): string {
  if (riskLevel === "high") return "1 active";
  if (riskLevel === "medium") return "Unknown";
  return "None";
}

type Rec = { label: string; bg: string; text: string };
function getAiRec(rank: number): Rec {
  if (rank === 0) return { label: "Top Choice", bg: "#e8f5ee", text: "#2e8b57" };
  if (rank === 1) return { label: "Strong Alternative", bg: "#e8f5ee", text: "#2e8b57" };
  return { label: "Risky Option", bg: "#fef3c7", text: "#92400e" };
}

type RiskBadge = { bg: string; text: string; label: string };
function getRiskBadge(riskLevel: string | null): RiskBadge {
  if (riskLevel === "high")   return { bg: "#fee2e2", text: "#991b1b", label: "High" };
  if (riskLevel === "medium") return { bg: "#fef3c7", text: "#92400e", label: "Medium" };
  return { bg: "#e8f5ee", text: "#2e8b57", label: "Low" };
}

// Skill levels by [rank][skillIndex]
const TECH_SKILL_MATRIX: Record<number, string[]> = {
  0: ["Expert",   "Expert",   "Advanced", "Expert"],
  1: ["Advanced", "Advanced", "Moderate", "Advanced"],
  2: ["Moderate", "Advanced", "Advanced", "Moderate"],
};
const CULTURE_MATRIX: Record<number, string[]> = {
  0: ["High",     "Strong",      "Moderate"],
  1: ["Very High","Very Strong", "High"],
  2: ["Moderate", "Strong",      "Low"],
};

function getTechLevel(rank: number, idx: number): string {
  return TECH_SKILL_MATRIX[rank]?.[idx] ?? "Moderate";
}
function getCultureLevel(rank: number, idx: number): string {
  return CULTURE_MATRIX[rank]?.[idx] ?? "Moderate";
}

/* ─── Recommended Card ───────────────────────────────────────── */
function RecommendedCard({
  candidate,
  onSendOffer,
  isSending,
  offerSent,
}: {
  candidate: CandidateData;
  onSendOffer: () => void;
  isSending: boolean;
  offerSent: boolean;
}) {
  const gaps = getGaps(candidate);
  const watchouts: string[] = [
    ...(candidate.riskLevel === "high"   ? ["Competing interview with another company", "Decision timeline may be short"] : []),
    ...(candidate.riskLevel === "medium" ? ["Compensation expectations may shift"] : []),
    ...(gaps.slice(0, 1)),
  ].slice(0, 2);

  return (
    <div
      className="w-[347px] shrink-0 rounded-[14px] border border-[#e5e7eb] flex flex-col"
      style={{ background: "linear-gradient(171.5deg, #0e3d27 2.6%, #1f6b43 96.2%)" }}
    >
      <div className="flex flex-col gap-9 px-4 py-8 flex-1">
        {/* Header */}
        <div className="flex gap-3 items-start">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-white/80 leading-5">Recommended Candidate</p>
            <p className="text-[20px] font-extrabold text-white leading-7 mt-0.5">{candidate.name}</p>
          </div>
        </div>

        {/* Explanation */}
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-white tracking-[0.3px]">EXPLANATION</p>
          <p className="text-[13px] font-medium text-white leading-[21px]">
            {candidate.summary ??
              `${candidate.name} has the strongest technical match for the role's required skills and demonstrated the highest interview performance. Compensation expectations remain within the approved band and risk signals are minimal.`}
          </p>
        </div>

        {/* Watchouts */}
        {watchouts.length > 0 && (
          <div
            className="rounded-[10px] p-4 flex flex-col gap-2"
            style={{ backgroundColor: "rgba(254,243,199,0.15)" }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#abdd64] shrink-0" />
              <p className="text-[12px] font-semibold text-[#abdd64] tracking-[0.3px]">WATCHOUTS</p>
            </div>
            <div className="flex flex-col gap-1">
              {watchouts.map((w, i) => (
                <p key={i} className="text-[13px] text-[#abdd64] leading-5">{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onSendOffer}
            disabled={isSending || offerSent}
            className="flex-1 h-10 rounded-[14px] bg-white text-[14px] font-semibold text-[#0e3d27] flex items-center justify-center gap-1.5 hover:bg-white/90 disabled:opacity-60 transition-colors"
          >
            {isSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {offerSent ? "✓ Offer Sent" : "Send Offer"}
          </button>
          <button className="flex-1 h-10 rounded-[14px] border border-white/30 text-white text-[14px] font-medium hover:bg-white/10 transition-colors shadow-[0px_4px_12px_0px_rgba(46,139,87,0.25)]">
            Review Alternatives
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Swap props shared between tables ───────────────────────── */
type SwapProps = {
  openDropdown: number | null;
  pool: CandidateData[];
  onToggleDropdown: (slot: number) => void;
  onSwap: (slot: number, candidateId: string) => void;
};

/* ─── Column header with swap dropdown ───────────────────────── */
function SwapHeader({ candidate, slotIndex, swap }: { candidate: CandidateData; slotIndex: number; swap: SwapProps }) {
  const available = swap.pool.filter(p => p.id !== candidate.id);
  const isOpen = swap.openDropdown === slotIndex;

  return (
    <div className="relative flex items-center justify-center gap-1.5">
      <button
        onClick={(e) => { e.stopPropagation(); swap.onToggleDropdown(slotIndex); }}
        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity select-none"
      >
        <span className="text-[13px] font-semibold text-[#111827] whitespace-nowrap">{candidate.name}</span>
        <ChevronRight className="w-[18px] h-[18px] text-[#6b7280] rotate-90 shrink-0" />
      </button>
      {isOpen && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 z-50 bg-white border border-[#e5e7eb] rounded-[10px] shadow-lg min-w-[190px] py-1 mt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold text-[#6b7280] tracking-wide uppercase">Switch Candidate</p>
          {available.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-[#6b7280]">No other candidates in pool</p>
          ) : (
            available.map(p => (
              <button
                key={p.id}
                onClick={() => swap.onSwap(slotIndex, p.id)}
                className="w-full px-3 py-2 text-left hover:bg-[#f0fdf4] transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #2e8b57, #1f6b43)" }}
                  >
                    {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <span className="text-[12px] font-medium text-[#111827] truncate">{p.name}</span>
                </div>
                <span className="text-[11px] text-[#6b7280] shrink-0">{p.fitScore ?? 0}%</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Summary Comparison Table ───────────────────────────────── */
function SummaryTable({ candidates, swap }: { candidates: CandidateData[]; swap: SwapProps }) {
  const rows: { label: string; render: (c: CandidateData, rank: number) => ReactNode }[] = [
    {
      label: "AI Recommendation",
      render: (c, rank) => {
        const rec = getAiRec(rank);
        return (
          <span
            className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: rec.bg, color: rec.text }}
          >
            {rec.label}
          </span>
        );
      },
    },
    {
      label: "Overall Match Score",
      render: (c) => <span className="text-[13px] font-semibold text-[#111827]">{c.fitScore ?? 0}%</span>,
    },
    {
      label: "Expected Salary",
      render: (c) => <span className="text-[13px] text-[#111827]">{getSalary(c.fitScore ?? 0)}</span>,
    },
    {
      label: "Offer Acceptance Probability",
      render: (c) => {
        const prob = getOfferProb(c.fitScore ?? 0);
        return (
          <div className="flex items-center gap-2 justify-center">
            <span className="text-[13px] font-semibold text-[#111827] w-9 shrink-0 text-right">{prob}%</span>
            <div className="h-2 w-24 bg-[#e5e7eb] rounded-full overflow-hidden">
              <div className="h-full bg-[#2e8b57] rounded-full" style={{ width: `${prob}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      label: "Competing Offers",
      render: (c) => <span className="text-[13px] text-[#6b7280]">{getCompetingOffers(c.riskLevel)}</span>,
    },
    {
      label: "Start Availability",
      render: (c) => <span className="text-[13px] text-[#6b7280]">{getStartAvailability(c.fitScore ?? 0)}</span>,
    },
    {
      label: "Interview Score",
      render: (c) => <span className="text-[13px] font-semibold text-[#111827]">{getInterviewScore(c.fitScore ?? 0)}</span>,
    },
    {
      label: "Risk Level",
      render: (c) => {
        const badge = getRiskBadge(c.riskLevel);
        return (
          <span
            className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            {badge.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-[14px] overflow-hidden flex-1 min-w-0">
      <div className="px-4 py-5 border-b border-[#e5e7eb]">
        <p className="text-[15px] font-bold text-[#111827]">Summary Comparison</p>
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="bg-[#f9fafb] px-6 py-4 text-left w-[220px]">
              <span className="text-[12px] font-semibold text-[#6b7280] tracking-wide">METRIC</span>
            </th>
            {candidates.map((c, i) => (
              <th key={c.id} className="bg-white px-6 py-[15px] text-center">
                <SwapHeader candidate={c} slotIndex={i} swap={swap} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[#e5e7eb]">
              <td className="bg-[#f9fafb] px-4 py-[18px] w-[220px]">
                <span className="text-[13px] font-medium text-[#111827]">{row.label}</span>
              </td>
              {candidates.map((c, rank) => (
                <td key={c.id} className="px-6 py-4 text-center">
                  <div className="flex justify-center">{row.render(c, rank)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Detail Card (collapsible) ──────────────────────────────── */
type DetailRow = {
  label: string;
  values: (c: CandidateData, rank: number) => string;
};
function DetailCard({
  title,
  colHeader,
  rows,
  insight,
  candidates,
}: {
  title: string;
  colHeader: string;
  rows: DetailRow[];
  insight: string;
  candidates: CandidateData[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-[14px] overflow-hidden flex-1 min-w-0 flex flex-col">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-4 py-5 w-full text-left hover:bg-[#f9fafb] transition-colors"
      >
        <span className="text-[15px] font-bold text-[#111827]">{title}</span>
        {open
          ? <ChevronUp className="w-5 h-5 text-[#6b7280]" />
          : <ChevronDown className="w-5 h-5 text-[#6b7280]" />
        }
      </button>
      {open && (
        <div className="border-t border-[#e5e7eb] flex flex-col flex-1">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                <th className="px-4 py-4 text-center">
                  <span className="text-[12px] font-semibold text-[#6b7280] tracking-wide">{colHeader}</span>
                </th>
                {candidates.map((c) => (
                  <th key={c.id} className="px-4 py-[15px] text-center">
                    <span className="text-[13px] font-semibold text-[#111827]">{c.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-[#e5e7eb] last:border-0">
                  <td className="px-4 py-4 text-center">
                    <span className="text-[13px] font-medium text-[#111827]">{row.label}</span>
                  </td>
                  {candidates.map((c, rank) => (
                    <td key={c.id} className="px-6 py-4 text-center">
                      <span className="text-[13px] text-[#6b7280]">{row.values(c, rank)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Insight footer */}
          <div className="bg-[#f7f9f8] border-t border-[#e2e8e5] p-4 flex gap-2 mt-auto">
            <TrendingUp className="w-4 h-4 text-[#0e3d27] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-[#0e3d27] tracking-wide mb-1">INSIGHT:</p>
              <p className="text-[12px] text-[#0e3d27] leading-5">{insight}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Offer Risk Signals ─────────────────────────────────────── */
function OfferRiskSignals({ candidates }: { candidates: CandidateData[] }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-[14px] overflow-hidden">
      <div className="px-4 py-5 border-b border-[#e5e7eb]">
        <p className="text-[15px] font-bold text-[#111827]">Offer Risk Signals</p>
      </div>
      <div className="flex gap-5 px-4 py-5">
        {candidates.map((c) => {
          const gaps = getGaps(c);
          const risks: string[] = [];
          if (c.riskLevel === "high") {
            risks.push("Competing interview with another company");
            risks.push("Decision timeline expected within 48 hours");
          } else if (c.riskLevel === "medium") {
            risks.push(gaps[0] ?? "Compensation expectations may increase after competing offers");
          }
          const hasRisk = risks.length > 0;
          const suggestedAction = hasRisk ? "Send offer within 48 hours to reduce risk." : null;

          return (
            <div key={c.id} className="flex-1 min-w-0 flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-[#111827]">{c.name}</p>
              <div className="bg-[#f7f7f7] rounded-[10px] px-4 pt-4 flex flex-col gap-6 flex-1">
                {!hasRisk ? (
                  <p className="text-[13px] text-[#111827] pb-4">No risk</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      {risks.map((r, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[13px] text-[#111827] leading-5">{r}</p>
                        </div>
                      ))}
                    </div>
                    {suggestedAction && (
                      <div className="border-t border-[#e2e8e5] py-6 flex flex-col gap-2">
                        <p className="text-[11px] font-semibold text-[#111827] tracking-wide">SUGGESTED ACTION:</p>
                        <p className="text-[13px] text-[#111827]">{suggestedAction}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Final Decision Bar ─────────────────────────────────────── */
function FinalDecisionBar({
  topCandidate,
  onApprove,
  isApproving,
  approved,
}: {
  topCandidate: CandidateData;
  onApprove: () => void;
  isApproving: boolean;
  approved: boolean;
}) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-[14px] overflow-hidden">
      <div className="px-6 py-5 flex items-center gap-4">
        <p className="text-[15px] font-bold text-[#111827] shrink-0">Final Decision</p>
        <div className="flex items-center gap-3">
          <button
            onClick={onApprove}
            disabled={isApproving || approved}
            className="h-10 px-4 rounded-[14px] text-white text-[13px] font-semibold flex items-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(173deg, #0e3d27 16.3%, #156139 71.8%)" }}
          >
            {isApproving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {approved ? `✓ Offer Approved` : `Approve Offer → ${topCandidate.name}`}
          </button>
          <button className="h-9 px-5 rounded-[10px] bg-white border border-[#e5e7eb] text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors">
            Compare Again
          </button>
          <button className="h-9 px-5 rounded-[10px] bg-white border border-[#e5e7eb] text-[13px] text-[#6b7280] hover:bg-[#f9fafb] transition-colors">
            Escalate to Hiring Manager
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function FinalistComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").filter(Boolean).slice(0, 3);

  const [offerSent, setOfferSent]       = useState(false);
  const [approved, setApproved]         = useState(false);
  const [slotIds, setSlotIds]           = useState<string[]>(ids);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const handleSwap = (slotIndex: number, candidateId: string) => {
    setSlotIds(prev => { const next = [...prev]; next[slotIndex] = candidateId; return next; });
    setOpenDropdown(null);
  };

  // Fetch each candidate (up to 3) — uses slotIds so swaps are reflected
  const q0 = useQuery({ ...trpc.recruiter.getCandidateById.queryOptions({ id: slotIds[0] ?? "" }), enabled: !!slotIds[0] });
  const q1 = useQuery({ ...trpc.recruiter.getCandidateById.queryOptions({ id: slotIds[1] ?? "" }), enabled: !!slotIds[1] });
  const q2 = useQuery({ ...trpc.recruiter.getCandidateById.queryOptions({ id: slotIds[2] ?? "" }), enabled: !!slotIds[2] });

  // Fetch interview pool for swap dropdown
  const allCandidatesQ = useQuery(trpc.recruiter.getCandidates.queryOptions());
  const interviewPool = (allCandidatesQ.data ?? []).filter(c => c.stage === "interview") as CandidateData[];

  const updateStage = useMutation(
    trpc.recruiter.updateCandidateStage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.recruiter.getCandidates.queryKey() });
      },
    })
  );

  const isLoading = q0.isLoading || q1.isLoading || q2.isLoading;

  if (ids.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-[14px] text-[#6b7280]">Select 2–3 candidates from the queue to compare.</p>
        <button
          onClick={() => router.push("/candidate-queue")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#0e3d27] text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Candidate Queue
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0e3d27]" />
      </div>
    );
  }

  // Build sorted candidates array (highest score first)
  const raw = [q0.data, q1.data, q2.data].filter(Boolean) as CandidateData[];
  const candidates = [...raw].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
  const topCandidate = candidates[0]!;

  const handleSendOffer = () => {
    updateStage.mutate({ id: topCandidate.id, stage: "offer" }, {
      onSuccess: () => setOfferSent(true),
    });
  };

  const handleApprove = () => {
    updateStage.mutate({ id: topCandidate.id, stage: "offer" }, {
      onSuccess: () => setApproved(true),
    });
  };

  // Technical strength rows — use candidate strengths for skill names
  const techSkills = (() => {
    const s0 = getStrengths(candidates[0]);
    return [
      s0[0] ?? "Python Systems",
      s0[1] ?? "System Design",
      "Microservices",
      "Scalability",
    ].slice(0, 4);
  })();

  const techRows: DetailRow[] = techSkills.map((skill, si) => ({
    label: skill,
    values: (_c, rank) => getTechLevel(rank, si),
  }));

  const cultureRows: DetailRow[] = [
    { label: "Ownership",       values: (_c, rank) => getCultureLevel(rank, 0) },
    { label: "Communication",   values: (_c, rank) => getCultureLevel(rank, 1) },
    { label: "Team Leadership", values: (_c, rank) => getCultureLevel(rank, 2) },
  ];

  const compRows: DetailRow[] = [
    { label: "Expected Salary",             values: (c) => getSalary(c.fitScore ?? 0) },
    { label: "Market Median",               values: () => getMarketMedian() },
    {
      label: "Compensation Gap",
      values: (c) => getCompGap(c.fitScore ?? 0),
    },
    { label: "Offer Acceptance Probability", values: (c) => `${getOfferProb(c.fitScore ?? 0)}%` },
  ];

  const swapProps: SwapProps = {
    openDropdown,
    pool: interviewPool,
    onToggleDropdown: (slot) => setOpenDropdown(prev => prev === slot ? null : slot),
    onSwap: handleSwap,
  };

  return (
    <div className="flex flex-col gap-4 pb-8" onClick={() => setOpenDropdown(null)}>

      {/* Page header */}
      <div className="bg-[#f7f7f7] rounded-[16px] px-4 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/candidate-queue")}
            className="flex items-center gap-1 px-2 py-1.5 rounded-[8px] text-[14px] font-medium text-[#111827] hover:bg-[#e2e8e5] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="text-[24px] font-bold text-[#111827] leading-8">Finalist Comparison</h1>
            <p className="text-[13px] text-[#6b7280]">
              Comparing {candidates.length} candidates · Select the best fit to extend an offer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {candidates.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-white border border-[#e2e8e5]">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #2e8b57, #1f6b43)" }}
              >
                {c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <span className="text-[12px] font-medium text-[#111827]">{c.name}</span>
              <span className="text-[11px] text-[#6b7280]">{c.fitScore}%</span>
              {i === 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#e8f5ee] text-[#2e8b57]">TOP</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Row 1: Recommended Card + Summary Table */}
      <div className="flex gap-4 items-stretch">
        <RecommendedCard
          candidate={topCandidate}
          onSendOffer={handleSendOffer}
          isSending={updateStage.isPending && !approved}
          offerSent={offerSent}
        />
        <SummaryTable candidates={candidates} swap={swapProps} />
      </div>

      {/* Row 2: Three detail cards */}
      <div className="flex gap-2 items-stretch">
        <DetailCard
          title="Technical Strength"
          colHeader="SKILL"
          rows={techRows}
          insight={`${candidates[0].name} demonstrated stronger distributed systems knowledge and provided real-world scaling examples during the system design interview.`}
          candidates={candidates}
        />
        <DetailCard
          title="Culture & Leadership"
          colHeader="ATTRIBUTE"
          rows={cultureRows}
          insight={`${candidates[1]?.name ?? candidates[0].name} showed stronger leadership signals, which may be valuable if the role evolves into managing a small team.`}
          candidates={candidates}
        />
        <DetailCard
          title="Compensation & Market"
          colHeader="METRIC"
          rows={compRows}
          insight={`${candidates[candidates.length - 1].name} has the highest probability of accepting quickly due to compensation alignment with market median.`}
          candidates={candidates}
        />
      </div>

      {/* Row 3: Offer Risk Signals */}
      <OfferRiskSignals candidates={candidates} />

      {/* Row 4: Final Decision */}
      <FinalDecisionBar
        topCandidate={topCandidate}
        onApprove={handleApprove}
        isApproving={updateStage.isPending && !offerSent}
        approved={approved}
      />
    </div>
  );
}
