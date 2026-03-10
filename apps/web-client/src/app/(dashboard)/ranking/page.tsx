"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useMemo, type ComponentType } from "react";
import {
  Search,
  ChevronDown,
  Download,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  Star,
  Share2,
  BarChart2,
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
  fair: "In Queue",
  screen: "Screening",
  interview: "Interview",
  offer: "Offer",
  day1: "Day 1",
};

function getSkills(c: Candidate): string[] {
  const raw = c.resumeHighlights;
  if (Array.isArray(raw)) return (raw as string[]).slice(0, 3);
  return [];
}

function scoreRingStyle(score: number): { bg: string; text: string } {
  if (score >= 85) return { bg: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)", text: "#fff" };
  return { bg: "#f7f7f7", text: "#0e3d27" };
}

function rankBadgeClass(rank: number) {
  if (rank === 1) return "bg-[#0e3d27] text-white";
  if (rank === 2) return "bg-[#1f6b43] text-white";
  if (rank === 3) return "bg-[#2d6a4f] text-white";
  return "bg-muted text-muted-foreground";
}

/* ─── Stat Pill ─────────────────────────────────────────────── */
function StatPill({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 flex-1">
      <div className="w-8 h-8 rounded-lg bg-[#e8f5ee] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#0e3d27]" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium leading-none mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-foreground leading-none">{value}</span>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Score Ring ─────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const { bg, text } = scoreRingStyle(score);
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
      style={{ background: bg }}
    >
      <span className="text-[10px] font-bold leading-none" style={{ color: text }}>
        {score}%
      </span>
    </div>
  );
}

/* ─── Rank Badge ─────────────────────────────────────────────── */
function RankBadge({ rank }: { rank: number }) {
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${rankBadgeClass(rank)}`}
    >
      {rank}
    </div>
  );
}

/* ─── Stage Pill ─────────────────────────────────────────────── */
function StagePill({ stage }: { stage: string }) {
  const isAdvanced = ["interview", "offer", "day1"].includes(stage);
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap border"
      style={
        isAdvanced
          ? { background: "#e8f5ee", color: "#1f6b43", borderColor: "#c5e4d1" }
          : { background: "#f7f7f7", color: "#6b7280", borderColor: "#e2e8e5" }
      }
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

/* ─── Ranked Row ─────────────────────────────────────────────── */
function RankedRow({
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
  const skills = getSkills(candidate);
  const hasRisk = candidate.riskLevel === "high" || candidate.riskLevel === "medium";

  return (
    <div
      onClick={() => onClick(candidate.id)}
      className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/20 transition-colors ${
        isShortlisted ? "bg-[#e8f5ee]/30" : rank <= 3 ? "bg-[#f9fbfa]" : ""
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isShortlisted}
        onChange={() => onToggle(candidate.id)}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-border accent-[#0e3d27] shrink-0 cursor-pointer"
      />

      {/* Rank badge */}
      <RankBadge rank={rank} />

      {/* Score ring */}
      <ScoreRing score={score} />

      {/* Name + school + skills */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{candidate.name}</span>
          {isShortlisted && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#e8f5ee] text-[#0e3d27] border border-[#c5e4d1] leading-none">
              SHORTLISTED
            </span>
          )}
          {hasRisk && (
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {candidate.school ?? "University"}
          {skills.length > 0 && (
            <span className="text-muted-foreground/60"> · {skills.slice(0, 2).join(" · ")}</span>
          )}
        </p>
      </div>

      {/* Stage */}
      <div className="shrink-0">
        <StagePill stage={stage} />
      </div>

      {/* Risk */}
      <div className="w-14 text-center shrink-0">
        <span
          className="text-[10px] font-semibold"
          style={{
            color:
              !candidate.riskLevel || candidate.riskLevel === "low"
                ? "#6b7280"
                : "#991b1b",
          }}
        >
          {!candidate.riskLevel || candidate.riskLevel === "low"
            ? "Clear"
            : candidate.riskLevel === "medium"
            ? "1 Flag"
            : "2 Flags"}
        </span>
      </div>
    </div>
  );
}

/* ─── Tier Section ───────────────────────────────────────────── */
function TierSection({
  title,
  description,
  accentColor,
  candidates,
  startRank,
  shortlisted,
  onToggle,
  onRowClick,
}: {
  title: string;
  description: string;
  accentColor: string;
  candidates: Candidate[];
  startRank: number;
  shortlisted: Set<string>;
  onToggle: (id: string) => void;
  onRowClick: (id: string) => void;
}) {
  if (candidates.length === 0) return null;
  return (
    <div>
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-border"
        style={{ background: `${accentColor}0a` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
          <span className="text-xs font-bold text-foreground">{title}</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-medium">
            {candidates.length}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{description}</span>
      </div>
      {candidates.map((c, i) => (
        <RankedRow
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

/* ─── Finalist Card (in shortlist panel) ─────────────────────── */
function FinalistCard({
  candidate,
  rank,
  topScore,
  onRemove,
}: {
  candidate: Candidate;
  rank: number;
  topScore: number;
  onRemove: (id: string) => void;
}) {
  const score = candidate.fitScore ?? 0;
  const delta = score - topScore;
  const stage = candidate.stage ?? "fair";
  const skills = getSkills(candidate);
  const hasRisk = candidate.riskLevel === "high" || candidate.riskLevel === "medium";

  return (
    <div className="px-4 py-3 border-b border-border last:border-0">
      {/* Name row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <RankBadge rank={rank} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{candidate.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{candidate.school}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-[#0e3d27] leading-tight">{score}%</p>
            {delta !== 0 && (
              <p className={`text-[9px] font-medium leading-tight ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {delta > 0 ? "+" : ""}{delta}pts
              </p>
            )}
            {delta === 0 && (
              <p className="text-[9px] text-muted-foreground leading-tight">#1 rank</p>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(candidate.id); }}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors text-sm leading-none"
            title="Remove from shortlist"
          >
            ×
          </button>
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 ml-8">
          {skills.slice(0, 2).map((s, i) => (
            <span key={i} className="text-[10px] text-muted-foreground">
              {s}&nbsp;<span className="text-[#0e3d27] font-bold">✓</span>
            </span>
          ))}
        </div>
      )}

      {/* Stage + risk */}
      <div className="flex items-center gap-2 mt-1.5 ml-8">
        <StagePill stage={stage} />
        {hasRisk && (
          <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />
            Risk flag
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Shortlist Panel ────────────────────────────────────────── */
function ShortlistPanel({
  shortlistedCandidates,
  topScore,
  onRemove,
}: {
  shortlistedCandidates: Candidate[];
  topScore: number;
  onRemove: (id: string) => void;
}) {
  const sorted = useMemo(
    () => [...shortlistedCandidates].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0)),
    [shortlistedCandidates]
  );

  const avgScore =
    sorted.length > 0
      ? Math.round(sorted.reduce((s, c) => s + (c.fitScore ?? 0), 0) / sorted.length)
      : 0;

  const scoreSpreadLow = sorted.length > 0 ? (sorted[sorted.length - 1]?.fitScore ?? 0) : 0;
  const scoreSpreadHigh = sorted.length > 0 ? (sorted[0]?.fitScore ?? 0) : 0;

  return (
    <div className="w-[268px] shrink-0 bg-card border border-border rounded-xl flex flex-col self-start sticky top-4">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
            Your Shortlist
          </span>
          <div className="flex items-center gap-1.5">
            {sorted.length > 0 && (
              <span className="text-[10px] font-semibold text-[#0e3d27]">avg {avgScore}%</span>
            )}
            <div className="h-5 min-w-[20px] px-1.5 rounded-full bg-[#0e3d27] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white leading-none">{sorted.length}</span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
          {sorted.length === 0
            ? "Check candidates from the ranked list to build your shortlist"
            : `${sorted.length} finalist${sorted.length !== 1 ? "s" : ""} · score delta shown vs #1`}
        </p>
      </div>

      {/* Finalists */}
      <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight: 400 }}>
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2.5">
              <Star className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select candidates from the ranked list to add them here
            </p>
          </div>
        ) : (
          sorted.map((c, i) => (
            <FinalistCard
              key={c.id}
              candidate={c}
              rank={i + 1}
              topScore={sorted[0]?.fitScore ?? topScore}
              onRemove={onRemove}
            />
          ))
        )}
      </div>

      {/* Score spread bar */}
      {sorted.length >= 2 && (
        <div className="px-4 py-2.5 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">Score range</span>
            <span className="text-[10px] font-semibold text-foreground">
              {scoreSpreadLow}% – {scoreSpreadHigh}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                background: "linear-gradient(90deg, #52b788 0%, #0e3d27 100%)",
                width: `${scoreSpreadHigh}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3.5 border-t border-border flex flex-col gap-2">
        <button
          disabled={sorted.length === 0}
          className="w-full h-10 rounded-[14px] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Finalize Shortlist
        </button>
        <div className="flex gap-2">
          <button className="flex-1 h-8 rounded-lg border border-border text-[10px] font-semibold text-foreground flex items-center justify-center gap-1 hover:bg-muted transition-colors">
            <Share2 className="w-3 h-3" />
            Share
          </button>
          <button className="flex-1 h-8 rounded-lg border border-border text-[10px] font-semibold text-foreground flex items-center justify-center gap-1 hover:bg-muted transition-colors">
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── View tabs ──────────────────────────────────────────────── */
const VIEWS = ["All Candidates", "Shortlisted", "Interview Ready"] as const;
type View = (typeof VIEWS)[number];

/* ─── Main Page ──────────────────────────────────────────────── */
export default function RankingPage() {
  const trpc = useTRPC();
  const router = useRouter();

  const { data: rawCandidates, isLoading, isError } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );
  const { data: roles } = useQuery(trpc.recruiter.getRoles.queryOptions());

  const [view, setView] = useState<View>("All Candidates");
  const [filterRole, setFilterRole] = useState("all");
  const [search, setSearch] = useState("");
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());

  const candidates = rawCandidates as Candidate[] | undefined;

  const toggleShortlist = (id: string) => {
    setShortlisted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // All candidates sorted by score (for stats)
  const allSorted = useMemo(() => {
    if (!candidates) return [];
    return [...candidates].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
  }, [candidates]);

  // Filtered + ranked list
  const ranked = useMemo(() => {
    let list = [...allSorted];
    if (search)
      list = list.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.school ?? "").toLowerCase().includes(search.toLowerCase())
      );
    if (filterRole !== "all")
      list = list.filter((c) => c.roleId === filterRole);
    if (view === "Shortlisted")
      list = list.filter((c) => shortlisted.has(c.id));
    else if (view === "Interview Ready")
      list = list.filter((c) => c.stage === "interview" || c.stage === "offer");
    return list;
  }, [allSorted, search, filterRole, view, shortlisted]);

  const tier1 = ranked.filter((c) => (c.fitScore ?? 0) >= 85);
  const tier2 = ranked.filter((c) => (c.fitScore ?? 0) >= 70 && (c.fitScore ?? 0) < 85);
  const tier3 = ranked.filter((c) => (c.fitScore ?? 0) < 70);

  const shortlistedCandidates = useMemo(
    () => (candidates ?? []).filter((c) => shortlisted.has(c.id)),
    [candidates, shortlisted]
  );

  const topScore = allSorted[0]?.fitScore ?? 0;
  const avgScore =
    allSorted.length > 0
      ? Math.round(allSorted.reduce((s, c) => s + (c.fitScore ?? 0), 0) / allSorted.length)
      : 0;

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Failed to load rankings. Please refresh.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#1f6b43] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight">
            Ranking &amp; Shortlist
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-ranked candidates by fit score · check to build your shortlist
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            disabled={shortlisted.size === 0}
            className="h-9 px-4 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Finalize Shortlist
            {shortlisted.size > 0 && (
              <span className="ml-0.5 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {shortlisted.size}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Stat pills ── */}
      <div className="flex gap-3">
        <StatPill
          icon={Users}
          label="Candidates Ranked"
          value={allSorted.length}
        />
        <StatPill
          icon={Star}
          label="Shortlisted"
          value={shortlisted.size}
          sub={`of ${allSorted.length}`}
        />
        <StatPill
          icon={TrendingUp}
          label="Top Score"
          value={`${topScore}%`}
        />
        <StatPill
          icon={BarChart2}
          label="Average Score"
          value={`${avgScore}%`}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center justify-between gap-4">
        {/* View tabs */}
        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 shrink-0">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                view === v
                  ? "bg-[#1a3829] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
              {v === "Shortlisted" && shortlisted.size > 0 && (
                <span className="ml-1.5 text-[9px] font-bold bg-white/20 px-1 py-0.5 rounded-full">
                  {shortlisted.size}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + role */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates..."
              className="h-8 w-48 rounded-lg border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#1f6b43]"
            />
          </div>
          <div className="relative">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="h-8 appearance-none pl-3 pr-7 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              {(roles as { id: string; title: string }[] | undefined)?.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex gap-5 items-start">

        {/* ── Ranked list ── */}
        <div className="flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden">

          {/* Column header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/20">
            <div className="w-4 shrink-0" />
            <div className="w-6 shrink-0" />
            <div className="w-10 shrink-0" />
            <div className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Candidate
            </div>
            <div className="shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-2">
              Stage
            </div>
            <div className="w-14 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Risk
            </div>
          </div>

          {/* Summary bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground">
              {ranked.length} candidate{ranked.length !== 1 ? "s" : ""} · ranked by AI fit score
            </span>
            {tier1.length > 0 && view === "All Candidates" && (
              <span className="text-xs font-semibold text-[#0e3d27]">
                {tier1.length} top match{tier1.length !== 1 ? "es" : ""} (85%+)
              </span>
            )}
          </div>

          {/* Tier sections */}
          {ranked.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No candidates match your filters
              </p>
            </div>
          ) : (
            <>
              <TierSection
                title="Tier 1 — Top Candidates"
                description="85%+ match"
                accentColor="#0e3d27"
                candidates={tier1}
                startRank={1}
                shortlisted={shortlisted}
                onToggle={toggleShortlist}
                onRowClick={(id) => router.push(`/candidate-queue/${id}`)}
              />
              <TierSection
                title="Tier 2 — Strong Candidates"
                description="70–84% match"
                accentColor="#1f6b43"
                candidates={tier2}
                startRank={tier1.length + 1}
                shortlisted={shortlisted}
                onToggle={toggleShortlist}
                onRowClick={(id) => router.push(`/candidate-queue/${id}`)}
              />
              <TierSection
                title="Tier 3 — Potential Candidates"
                description="Below 70% match"
                accentColor="#52b788"
                candidates={tier3}
                startRank={tier1.length + tier2.length + 1}
                shortlisted={shortlisted}
                onToggle={toggleShortlist}
                onRowClick={(id) => router.push(`/candidate-queue/${id}`)}
              />
            </>
          )}
        </div>

        {/* ── Shortlist Panel ── */}
        <ShortlistPanel
          shortlistedCandidates={shortlistedCandidates}
          topScore={topScore}
          onRemove={toggleShortlist}
        />
      </div>
    </div>
  );
}
