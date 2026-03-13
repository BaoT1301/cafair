"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import {
  Search, ChevronDown, Share2, BarChart2,
  X, Loader2, CheckCircle2, Calendar, Link as LinkIcon,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */
type Candidate = {
  id: string;
  name: string;
  school: string | null;
  role: string | null;
  roleId: string | null;
  fitScore: number | null;
  stage: string | null;
  riskLevel: string | null;
  priority: boolean | null;
  resumeHighlights: unknown;
  avatarUrl: string | null;
};

/* ─── Helpers ────────────────────────────────────────────────── */
const STAGE_LABELS: Record<string, string> = {
  fair:      "In Queue",
  screen:    "Phone Screen",
  interview: "Interview",
  offer:     "Offer",
  day1:      "Day 1",
};

function getScreenStatus(c: Candidate): "Done" | "Pending" {
  return c.riskLevel === "low" ? "Done" : "Pending";
}

function getRiskLabel(c: Candidate): "Clear" | "1 Flag" | "2 Flags" {
  if (c.riskLevel === "high")   return "2 Flags";
  if (c.riskLevel === "medium") return "1 Flag";
  return "Clear";
}

function getSkills(c: Candidate): string[] {
  const raw = c.resumeHighlights;
  if (Array.isArray(raw)) return (raw as string[]).slice(0, 3);
  return [];
}

/* ─── Score Circle ───────────────────────────────────────────── */
function ScoreCircle({ score }: { score: number }) {
  const isTier1 = score >= 85;
  return (
    <div
      className="h-14 w-14 rounded-full flex items-center justify-center shrink-0"
      style={
        isTier1
          ? { background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)", border: "1.25px solid #2e8b57" }
          : { background: "#f7f7f7", border: "1.25px solid #e2e8e5" }
      }
    >
      <span
        className="text-[15px] font-semibold leading-none"
        style={{ color: isTier1 ? "#fff" : "#0e3d27" }}
      >
        {score}%
      </span>
    </div>
  );
}

/* ─── Stage Pill ─────────────────────────────────────────────── */
function StagePill({ stage }: { stage: string }) {
  return (
    <span className="inline-flex items-center text-xs px-2 py-1 rounded-[4px] bg-[#f7f7f7] border border-[#e2e8e5] text-[#6b7280] font-normal whitespace-nowrap">
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

/* ─── Candidate Row ──────────────────────────────────────────── */
function CandidateRow({
  rank,
  candidate,
  isShortlisted,
  onToggle,
  onClick,
}: {
  rank: number;
  candidate: Candidate;
  isShortlisted: boolean;
  onToggle: (id: string) => void;
  onClick: (id: string) => void;
}) {
  const score        = candidate.fitScore ?? 0;
  const stage        = candidate.stage ?? "fair";
  const screenStatus = getScreenStatus(candidate);
  const riskLabel    = getRiskLabel(candidate);
  const skills       = getSkills(candidate);
  const isNew        = candidate.priority === true;
  const hasRisk      = candidate.riskLevel === "high" || candidate.riskLevel === "medium";

  return (
    <div
      className={`flex items-center gap-4 px-6 py-3.5 border-b border-[#e2e8e5] last:border-0 hover:bg-[#f7f7f7]/60 transition-colors cursor-pointer ${
        isShortlisted ? "bg-[#e8f5ee]/30" : "bg-white"
      }`}
      onClick={() => onClick(candidate.id)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isShortlisted}
        onChange={() => onToggle(candidate.id)}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-[#e2e8e5] shrink-0"
        style={{ accentColor: "#1f6b43" }}
      />

      {/* Rank */}
      <span className="text-sm text-[#6b7280] w-4 shrink-0 text-center">{rank}</span>

      {/* Name + badges + skills */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-normal text-[#111827]">{candidate.name}</span>
          {isNew && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-[6px] bg-white border border-[#e2e8e5] text-[#111827] leading-none">
              NEW
            </span>
          )}
          {hasRisk && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-[6px] bg-[#fee2e2] text-[#991b1b] leading-none">
              Risk
            </span>
          )}
        </div>
        <p className="text-[13px] text-[#6b7280] mt-0.5 truncate">
          {skills.length > 0 ? skills.join(" · ") : "No additional info"}
        </p>
      </div>

      {/* Stage */}
      <div className="shrink-0 flex flex-col items-center gap-1 w-[122px]">
        <p className="text-[11px] text-[#6b7280]">Stage</p>
        <StagePill stage={stage} />
      </div>

      {/* Screen */}
      <div className="shrink-0 text-center w-20 flex flex-col items-center gap-1">
        <p className="text-[11px] text-[#6b7280]">Screen</p>
        <span
          className="text-xs font-normal"
          style={{ color: screenStatus === "Done" ? "#1f6b43" : "#92400e" }}
        >
          {screenStatus}
        </span>
      </div>

      {/* Risk */}
      <div className="shrink-0 text-center w-20 flex flex-col items-center gap-1">
        <p className="text-[11px] text-[#6b7280]">Risk</p>
        <span
          className="text-xs font-normal"
          style={{ color: riskLabel === "Clear" ? "#6b7280" : "#991b1b" }}
        >
          {riskLabel}
        </span>
      </div>

      {/* Score */}
      <ScoreCircle score={score} />
    </div>
  );
}

/* ─── Tier Section ───────────────────────────────────────────── */
function TierSection({
  title, matchRange, candidates, startRank, shortlisted, onToggle, onRowClick,
}: {
  title: string;
  matchRange: string;
  candidates: Candidate[];
  startRank: number;
  shortlisted: Set<string>;
  onToggle: (id: string) => void;
  onRowClick: (id: string) => void;
}) {
  if (candidates.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 px-6 py-2.5 bg-[#f7f7f7]/60 border-b border-[#e2e8e5]">
        <input type="checkbox" className="w-4 h-4 rounded border-[#e2e8e5]" onChange={() => {}} />
        <span className="text-[18px] font-bold text-[#111827] tracking-[-0.045em] flex-1">{title}</span>
        <div className="flex-1 h-px bg-[#e2e8e5] mx-3" />
        <span className="text-xs text-[#6b7280]">{matchRange}</span>
      </div>
      {candidates.map((c, i) => (
        <CandidateRow
          key={c.id}
          rank={startRank + i}
          candidate={c}
          isShortlisted={shortlisted.has(c.id)}
          onToggle={onToggle}
          onClick={onRowClick}
        />
      ))}
    </div>
  );
}

/* ─── Schedule Batch Modal ───────────────────────────────────── */
function ScheduleBatchModal({
  candidates,
  onClose,
  onConfirm,
  isPending,
  isSuccess,
}: {
  candidates: Candidate[];
  onClose: () => void;
  onConfirm: (data: { date: string; time: string; duration: string; type: string }) => void;
  isPending: boolean;
  isSuccess: boolean;
}) {
  const today = new Date().toISOString().split("T")[0]!;
  const [date, setDate]         = useState(today);
  const [time, setTime]         = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [callType, setCallType] = useState("Phone Screen");

  if (isSuccess) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      >
        <div className="bg-white rounded-[20px] shadow-2xl w-[440px] max-w-full">
          <div className="px-8 py-10 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#e8f5ee] flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#1f6b43]" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#111827]">Batch Scheduled</h2>
              <p className="text-[13px] text-[#6b7280] mt-1 leading-5">
                {candidates.length} {callType} call{candidates.length !== 1 ? "s" : ""} queued for {date} starting at {time}.
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-10 px-6 rounded-[12px] text-white text-[14px] font-medium"
              style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-[20px] shadow-2xl w-[520px] max-w-full flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#e2e8e5]">
          <div>
            <h2 className="text-[18px] font-bold text-[#111827] leading-7">Schedule Batch Calls</h2>
            <p className="text-[13px] text-[#6b7280] mt-0.5">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#111827] transition-colors mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Candidate list */}
        <div className="max-h-[180px] overflow-y-auto divide-y divide-[#e2e8e5] border-b border-[#e2e8e5]">
          {candidates.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 px-6 py-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0e3d27] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#111827] truncate">{c.name}</p>
                <p className="text-[11px] text-[#6b7280] truncate">{c.school}</p>
              </div>
              <span className="text-[12px] font-bold text-[#0e3d27] shrink-0">{c.fitScore ?? 0}%</span>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#4b5563]">Start Date</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 px-3 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#1f6b43]"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#4b5563]">Start Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 px-3 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#1f6b43]"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#4b5563]">Call Type</label>
              <select
                value={callType}
                onChange={(e) => setCallType(e.target.value)}
                className="h-10 px-3 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#1f6b43] bg-white"
              >
                <option>Phone Screen</option>
                <option>Video Screen</option>
                <option>Technical Screen</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#4b5563]">Duration per call</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-10 px-3 rounded-[10px] border border-[#e2e8e5] text-[14px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#1f6b43] bg-white"
              >
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
              </select>
            </div>
          </div>

          {/* Time block preview */}
          <div className="bg-[#f7f7f7] rounded-[10px] px-4 py-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0e3d27] shrink-0" />
            <p className="text-[12px] text-[#4b5563]">
              <span className="font-semibold text-[#111827]">{candidates.length} call{candidates.length !== 1 ? "s" : ""}</span>
              {" · "}{duration} min each{" · "}
              total block ~{Math.ceil((candidates.length * parseInt(duration)) / 60 * 10) / 10}h starting {time} on {date}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8e5]">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-[12px] border border-[#e2e8e5] bg-white text-[14px] font-medium text-[#111827] hover:bg-[#f7f7f7] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ date, time, duration, type: callType })}
            disabled={isPending || !date || !time}
            className="h-10 px-5 rounded-[12px] text-white text-[14px] font-medium flex items-center gap-2 disabled:opacity-50 transition-opacity"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Shortlist Panel ────────────────────────────────────────── */
function ShortlistPanel({
  shortlistedCandidates, total, onCompare, onScheduleBatch, onShareLink, shareSuccess, isInterviewTab,
}: {
  shortlistedCandidates: Candidate[];
  total: number;
  onCompare: () => void;
  onScheduleBatch: () => void;
  onShareLink: () => void;
  shareSuccess: boolean;
  isInterviewTab: boolean;
}) {
  return (
    <div className="w-[288px] shrink-0 bg-[#f7f7f7] rounded-[16px] flex flex-col self-start sticky top-4 p-6 gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold text-[#111827] uppercase tracking-[0.35px]">
            Shortlist Panel
          </span>
          <div
            className="h-6 min-w-[24px] px-1.5 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)" }}
          >
            <span className="text-[12px] font-semibold text-white leading-none">
              {shortlistedCandidates.length}
            </span>
          </div>
        </div>
        <p className="text-xs text-[#4b5563]">
          {shortlistedCandidates.length} of {total} candidates shortlisted
        </p>
        {shortlistedCandidates.length > 0 && (
          <p className="text-[10px] text-[#6b7280]">Hover any score to compare vs. #1</p>
        )}
      </div>

      {/* Candidates */}
      <div className="flex flex-col gap-5">
        {shortlistedCandidates.length === 0 ? (
          <div className="bg-white rounded-[16px] p-4 text-center">
            <p className="text-xs text-[#4b5563]">Check candidates to add them to the shortlist</p>
          </div>
        ) : (
          shortlistedCandidates.map((c) => {
            const skills  = getSkills(c);
            const hasRisk = c.riskLevel === "high" || c.riskLevel === "medium";
            return (
              <div key={c.id} className="bg-white rounded-[16px] p-4 flex flex-col gap-3">
                <div>
                  <p className="text-[16px] font-semibold text-[#111827]">
                    {c.name}&nbsp;·&nbsp;{c.fitScore}%
                  </p>
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-x-2 mt-1">
                      {skills.slice(0, 2).map((s, i) => (
                        <span key={i} className="text-xs text-[#4b5563]">
                          {s} <span className="text-[#1f6b43] font-bold">✓</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {hasRisk && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#991b1b] shrink-0" />
                    <span className="text-xs text-[#991b1b]">Risk flag — review before presenting</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {isInterviewTab ? (
          <>
            <button
              onClick={onCompare}
              disabled={shortlistedCandidates.length < 2 || shortlistedCandidates.length > 3}
              className="h-10 rounded-[14px] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
            >
              <BarChart2 className="h-4 w-4" />
              Compare candidates
            </button>
            {shortlistedCandidates.length === 1 && (
              <p className="text-[10px] text-[#6b7280] text-center">Select 1 more candidate to compare</p>
            )}
            {shortlistedCandidates.length > 3 && (
              <p className="text-[10px] text-[#991b1b] text-center">Max 3 candidates for comparison</p>
            )}
          </>
        ) : (
          <button
            onClick={onScheduleBatch}
            disabled={shortlistedCandidates.length === 0}
            className="h-10 rounded-[14px] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            <Calendar className="h-4 w-4" />
            Schedule Batch Call
          </button>
        )}
        <button
          onClick={onShareLink}
          className="h-10 rounded-[14px] border border-[#0e3d27] text-sm font-medium text-[#4b5563] flex items-center justify-center gap-2 hover:bg-[#e8f5ee] transition-all active:scale-[0.97]"
        >
          {shareSuccess
            ? <><LinkIcon className="h-4 w-4 text-[#1f6b43]" /><span className="text-[#1f6b43]">Link Copied!</span></>
            : <><Share2 className="h-4 w-4" />Share Link</>
          }
        </button>
      </div>
    </div>
  );
}

/* ─── Filter Tabs ────────────────────────────────────────────── */
// Shortlisted comes BEFORE Screen complete per design
const TABS = [
  "All",
  "Shortlisted",
  "Screen complete",
  "Flagged",
  "Reviewing",
  "Interview",
] as const;
type Tab = (typeof TABS)[number];

/* ─── Main Page ──────────────────────────────────────────────── */
export default function CandidateQueuePage() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: rawCandidates, isLoading, isError } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );
  const { data: roles } = useQuery(trpc.recruiter.getRoles.queryOptions());

  const [activeTab, setActiveTab] = useState<Tab>("All");
  const roleParam = searchParams.get("role") ?? "all";
  const [sortRole, setSortRole] = useState(
    roleParam.startsWith("mock-") ? "all" : roleParam
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [shortlisted, setShortlisted]         = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen]             = useState(false);
  const [batchSuccess, setBatchSuccess]       = useState(false);
  const [shareSuccess, setShareSuccess]       = useState(false);

  const createAction = useMutation(trpc.recruiter.createAction.mutationOptions());

  // Shortlist limit — set by recruiter in JD setup, stored in localStorage
  const [shortlistLimit, setShortlistLimit] = useState<number>(20);
  useEffect(() => {
    const stored = localStorage.getItem("shortlist-limit");
    if (stored) setShortlistLimit(parseInt(stored, 10) || 20);
  }, []);

  const candidates = rawCandidates as Candidate[] | undefined;

  const toggleShortlist = (id: string) => {
    setShortlisted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // All candidates sorted by fitScore DESC
  const allSorted = useMemo(() => {
    if (!candidates) return [];
    return [...candidates].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
  }, [candidates]);

  const filtered = useMemo(() => {
    let list = allSorted;

    if (search)
      list = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

    if (sortRole !== "all")
      list = list.filter((c) => c.roleId === sortRole);

    if (activeTab === "Shortlisted")
      // AI shortlist = top N by fitScore (recruiter-configured limit)
      list = list.slice(0, shortlistLimit);
    else if (activeTab === "Screen complete")
      list = list.filter((c) => ["interview", "offer", "day1"].includes(c.stage ?? ""));
    else if (activeTab === "Flagged")
      list = list.filter((c) => c.riskLevel === "high" || c.riskLevel === "medium");
    else if (activeTab === "Reviewing")
      list = list.filter((c) => c.stage === "screen");
    else if (activeTab === "Interview")
      list = list.filter((c) => c.stage === "interview");

    return list;
  }, [allSorted, search, sortRole, activeTab, shortlistLimit]);

  const tier1 = filtered.filter((c) => (c.fitScore ?? 0) >= 85);
  const tier2 = filtered.filter((c) => (c.fitScore ?? 0) >= 70 && (c.fitScore ?? 0) < 85);
  const tier3 = filtered.filter((c) => (c.fitScore ?? 0) < 70);

  const shortlistedCandidates = allSorted.filter((c) => shortlisted.has(c.id));

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 2000);
  };

  const handleBatchConfirm = async ({ date, time, duration, type }: { date: string; time: string; duration: string; type: string }) => {
    for (const candidate of shortlistedCandidates) {
      await createAction.mutateAsync({
        candidateId: candidate.id,
        actionType: "schedule_interview",
        notes: `Batch ${type} · ${date} ${time} · ${duration} min`,
      });
    }
    setBatchSuccess(true);
  };

  const handleBatchClose = () => {
    setBatchOpen(false);
    setBatchSuccess(false);
  };

  if (isError) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-[#6b7280]">Failed to load candidates. Please refresh.</p>
    </div>
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#1f6b43] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4 p-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between bg-[#f7f7f7] rounded-[16px] px-4 py-5">
        <h1 className="text-[32px] font-bold text-[#111827] leading-10 tracking-[0.006em]">
          Candidate Queue
        </h1>
        <div className="relative w-[318px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7280] pointer-events-none" />
          <input
            type="text"
            placeholder="Search candidate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[42px] w-full rounded-[14px] border border-[#e2e8e5] bg-white pl-9 pr-4 text-sm text-[#111827] placeholder:text-[#4b5563] focus:outline-none focus:ring-1 focus:ring-[#1f6b43]"
          />
        </div>
      </div>

      {/* ── Filter Tabs + Sort ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5 bg-white border border-[#e2e8e5] rounded-[14px] p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-[10px] text-sm transition-all whitespace-nowrap active:scale-[0.97]"
              style={
                activeTab === tab
                  ? { background: "#0e3d27", color: "#ffffff", fontWeight: 600 }
                  : { background: "transparent", color: "#4b5563", fontWeight: 400 }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[#111827]">Sort by role</span>
          <div className="relative">
            <select
              value={sortRole}
              onChange={(e) => setSortRole(e.target.value)}
              className="h-9 appearance-none pl-4 pr-8 rounded-[14px] bg-white border-0 text-sm text-[#111827] font-medium focus:outline-none"
            >
              <option value="all">All</option>
              {(roles as { id: string; title: string }[] | undefined)?.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4b5563] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Shortlist tab info banner ── */}
      {activeTab === "Shortlisted" && (
        <div className="flex items-center gap-2 text-sm text-[#4b5563] bg-[#e8f5ee] rounded-[10px] px-4 py-2.5">
          <span className="font-medium text-[#0e3d27]">AI Shortlist</span>
          <span>— showing top {shortlistLimit} candidates by fit score</span>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex gap-4 items-start">

        {/* Candidate list */}
        <div className="flex-1 min-w-0 bg-white border border-[#e2e8e5] rounded-[16px] overflow-hidden">
          {/* Summary bar */}
          <div className="flex items-center justify-end px-6 py-3 border-b border-[#e2e8e5]">
            <span className="text-sm text-[#6b7280]">
              {filtered.length} candidates · Target close Feb 28
            </span>
            {tier1.length > 0 && (
              <span className="ml-auto text-xs font-normal text-[#6b7280]">
                {tier1[0]?.fitScore ?? 0}%+ match
              </span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-[#6b7280]">No candidates match your filters</p>
            </div>
          ) : (
            <>
              <TierSection
                title="Tier 1 — Top Candidates"
                matchRange="85%+ match"
                candidates={tier1}
                startRank={1}
                shortlisted={shortlisted}
                onToggle={toggleShortlist}
                onRowClick={(id) => router.push(`/candidate-queue/${id}`)}
              />
              <TierSection
                title="Tier 2 — Strong Candidates"
                matchRange="70–84% match"
                candidates={tier2}
                startRank={tier1.length + 1}
                shortlisted={shortlisted}
                onToggle={toggleShortlist}
                onRowClick={(id) => router.push(`/candidate-queue/${id}`)}
              />
              <TierSection
                title="Tier 3 — Potential Candidates"
                matchRange="<70% match"
                candidates={tier3}
                startRank={tier1.length + tier2.length + 1}
                shortlisted={shortlisted}
                onToggle={toggleShortlist}
                onRowClick={(id) => router.push(`/candidate-queue/${id}`)}
              />
            </>
          )}
        </div>

        {/* Shortlist Panel */}
        <ShortlistPanel
          shortlistedCandidates={shortlistedCandidates}
          total={filtered.length}
          isInterviewTab={activeTab === "Interview"}
          onCompare={() => {
            const ids = shortlistedCandidates.map((c) => c.id).join(",");
            router.push(`/candidate-queue/compare?ids=${ids}`);
          }}
          onScheduleBatch={() => setBatchOpen(true)}
          onShareLink={handleShareLink}
          shareSuccess={shareSuccess}
        />
      </div>

      {/* Batch Schedule Modal */}
      {batchOpen && (
        <ScheduleBatchModal
          candidates={shortlistedCandidates}
          onClose={handleBatchClose}
          onConfirm={handleBatchConfirm}
          isPending={createAction.isPending}
          isSuccess={batchSuccess}
        />
      )}
    </div>
  );
}
