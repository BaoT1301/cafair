"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { Search, ChevronDown, Share2, BarChart2 } from "lucide-react";

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

/* ─── Data derivations ───────────────────────────────────────── */
const STAGE_LABELS: Record<string, string> = {
  fair:      "In Queue",
  screen:    "Phone Screen",
  interview: "Interview",
  offer:     "Offer",
  day1:      "Day 1",
};

function getScreenStatus(c: Candidate): "Done" | "Pending" {
  // AI flagged = needs recruiter review = Pending; clean = Done
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
function scoreColor(score: number): string {
  if (score >= 88) return "#1a3829";
  if (score >= 80) return "#2d6a4f";
  if (score >= 70) return "#52b788";
  return "#b7e4c7";
}

function ScoreCircle({ score }: { score: number }) {
  return (
    <div
      className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: scoreColor(score) }}
    >
      <span className="text-[11px] font-bold text-white leading-none">
        {score}%
      </span>
    </div>
  );
}

/* ─── Stage Pill ─────────────────────────────────────────────── */
function StagePill({ stage }: { stage: string }) {
  return (
    <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-md bg-secondary border border-border text-foreground font-medium whitespace-nowrap">
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
  const score = candidate.fitScore ?? 0;
  const stage = candidate.stage ?? "fair";
  const screenStatus = getScreenStatus(candidate);
  const riskLabel = getRiskLabel(candidate);
  const skills = getSkills(candidate);
  const isNew = candidate.priority === true;
  const hasRisk = candidate.riskLevel === "high" || candidate.riskLevel === "medium";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer ${
        isShortlisted ? "bg-primary/5" : ""
      }`}
      onClick={() => onClick(candidate.id)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isShortlisted}
        onChange={() => onToggle(candidate.id)}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-border accent-primary shrink-0"
      />

      {/* Rank */}
      <span className="text-sm text-muted-foreground w-4 shrink-0 text-center">
        {rank}
      </span>

      {/* Name + badges + skills */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {candidate.name}
          </span>
          {isNew && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 leading-none">
              NEW
            </span>
          )}
          {hasRisk && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200 leading-none">
              Risk
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {skills.length > 0 ? skills.join(" · ") : "No additional info"}
        </p>
      </div>

      {/* Stage */}
      <div className="shrink-0">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">
          Stage
        </p>
        <StagePill stage={stage} />
      </div>

      {/* Screen */}
      <div className="shrink-0 text-center w-14">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">
          Screen
        </p>
        <span
          className={`text-xs font-semibold ${
            screenStatus === "Done" ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {screenStatus}
        </span>
      </div>

      {/* Risk */}
      <div className="shrink-0 text-center w-14">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">
          Risk
        </p>
        <span
          className={`text-xs font-semibold ${
            riskLabel === "Clear" ? "text-emerald-600" : "text-red-600"
          }`}
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
  title,
  matchRange,
  candidates,
  startRank,
  shortlisted,
  onToggle,
  onRowClick,
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
      {/* Tier header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-border"
            onChange={() => {}}
          />
          <span className="text-sm font-bold text-foreground">{title}</span>
        </div>
        <span className="text-xs text-muted-foreground">{matchRange}</span>
      </div>

      {/* Candidate rows */}
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

/* ─── Shortlist Panel ────────────────────────────────────────── */
function ShortlistPanel({
  shortlistedCandidates,
  total,
  onCompare,
  isInterviewTab,
}: {
  shortlistedCandidates: Candidate[];
  total: number;
  onCompare: () => void;
  isInterviewTab: boolean;
}) {
  return (
    <div className="w-[268px] shrink-0 bg-card border border-border rounded-xl flex flex-col self-start sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
          Shortlist Panel
        </span>
        <div className="h-5 min-w-[20px] px-1.5 rounded-full bg-[#1a3829] flex items-center justify-center">
          <span className="text-[10px] font-bold text-white leading-none">
            {shortlistedCandidates.length}
          </span>
        </div>
      </div>

      {/* Subtitle */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground">
          {shortlistedCandidates.length} of {total} candidates shortlisted
        </p>
        {shortlistedCandidates.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Hover any score to compare vs. #1
          </p>
        )}
      </div>

      {/* Shortlisted candidates list */}
      <div className="divide-y divide-border">
        {shortlistedCandidates.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              Check candidates to add them to the shortlist
            </p>
          </div>
        ) : (
          shortlistedCandidates.map((c) => {
            const skills = getSkills(c);
            const hasRisk =
              c.riskLevel === "high" || c.riskLevel === "medium";
            return (
              <div key={c.id} className="px-4 py-3.5">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {c.name}&nbsp;&middot;&nbsp;{c.fitScore}%
                </p>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1.5">
                    {skills.slice(0, 2).map((s, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-muted-foreground"
                      >
                        {s}{" "}
                        <span className="text-emerald-500 font-bold">✓</span>
                      </span>
                    ))}
                  </div>
                )}
                {hasRisk && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-[10px] text-red-600">
                      Risk flag — review before presenting
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3.5 border-t border-border flex flex-col gap-2 mt-auto">
        {isInterviewTab ? (
          <>
            <button
              onClick={onCompare}
              disabled={shortlistedCandidates.length < 2 || shortlistedCandidates.length > 3}
              className="w-full h-10 rounded-[14px] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
              title={shortlistedCandidates.length < 2 ? "Select 2–3 candidates to compare" : undefined}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Compare candidates
            </button>
            {shortlistedCandidates.length === 1 && (
              <p className="text-[10px] text-muted-foreground text-center">Select 1 more candidate to compare</p>
            )}
            {shortlistedCandidates.length > 3 && (
              <p className="text-[10px] text-red-500 text-center">Max 3 candidates for comparison</p>
            )}
          </>
        ) : (
          <button className="w-full h-10 rounded-[14px] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            Schedule Batch Call
          </button>
        )}
        <button className="w-full h-8 rounded-lg border border-border text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 hover:bg-muted transition-colors">
          <Share2 className="h-3 w-3" />
          Share Link
        </button>
      </div>
    </div>
  );
}

/* ─── Filter Tabs ────────────────────────────────────────────── */
const TABS = [
  "All",
  "Screen complete",
  "Shortlisted",
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
  // Ignore mock role IDs (mock-1, mock-2, mock-3) — they don't exist in DB
  const [sortRole, setSortRole] = useState(
    roleParam.startsWith("mock-") ? "all" : roleParam
  );
  const [search, setSearch] = useState(
    searchParams.get("search") ?? ""
  );
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());

  const candidates = rawCandidates as Candidate[] | undefined;

  const toggleShortlist = (id: string) => {
    setShortlisted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Sort by fitScore descending, then apply filters
  const filtered = useMemo(() => {
    if (!candidates) return [];
    let list = [...candidates].sort(
      (a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0)
    );

    if (search)
      list = list.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      );

    if (sortRole !== "all")
      list = list.filter((c) => c.roleId === sortRole);

    if (activeTab === "Screen complete")
      // Passed the phone screen — now in interview, offer, or day1
      list = list.filter((c) => ["interview", "offer", "day1"].includes(c.stage ?? ""));
    else if (activeTab === "Shortlisted")
      list = list.filter((c) => shortlisted.has(c.id));
    else if (activeTab === "Flagged")
      list = list.filter(
        (c) => c.riskLevel === "high" || c.riskLevel === "medium"
      );
    else if (activeTab === "Reviewing")
      // Currently in phone screen phase
      list = list.filter((c) => c.stage === "screen");
    else if (activeTab === "Interview")
      list = list.filter((c) => c.stage === "interview");

    return list;
  }, [candidates, search, sortRole, activeTab, shortlisted]);

  const tier1 = filtered.filter((c) => (c.fitScore ?? 0) >= 85);
  const tier2 = filtered.filter(
    (c) => (c.fitScore ?? 0) >= 70 && (c.fitScore ?? 0) < 85
  );
  const tier3 = filtered.filter((c) => (c.fitScore ?? 0) < 70);

  const shortlistedCandidates = filtered.filter((c) =>
    shortlisted.has(c.id)
  );

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Failed to load candidates. Please refresh.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-foreground leading-tight">
          Candidate Queue
        </h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search candidate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* ── Filter Tabs + Sort ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "bg-[#1a3829] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sort by role */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by role</span>
          <div className="relative">
            <select
              value={sortRole}
              onChange={(e) => setSortRole(e.target.value)}
              className="h-8 appearance-none pl-3 pr-7 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none"
            >
              <option value="all">All</option>
              {(roles as { id: string; title: string }[] | undefined)?.map(
                (r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                )
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex gap-5 items-start">

        {/* Candidate list */}
        <div className="flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden">
          {/* Summary bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <span className="text-xs text-muted-foreground">
              {filtered.length} candidates&nbsp;&nbsp;·&nbsp;&nbsp;Target close Feb 28
            </span>
            {tier1.length > 0 && (
              <span className="text-xs font-semibold text-foreground">
                {tier1[0]?.fitScore ?? 0}%+ match
              </span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No candidates match your filters
              </p>
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
            const ids = shortlistedCandidates.map(c => c.id).join(",");
            router.push(`/candidate-queue/compare?ids=${ids}`);
          }}
        />
      </div>
    </div>
  );
}
