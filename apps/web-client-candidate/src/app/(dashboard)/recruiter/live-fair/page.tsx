"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Clock, Mic, CornerDownRight, UserCheck,
  Zap, X, ChevronRight, Play, Shield,
} from "lucide-react";
import { RiskBadge } from "@/components/recruiter/RiskBadge";
import { Avatar } from "@/components/recruiter/Avatar";

// ─── Types ────────────────────────────────────────────────
type Lane = "recruiter_now" | "quick_screen" | "redirect";
type Risk = "low" | "medium" | "high";

// ─── Lane config ──────────────────────────────────────────
const LANES = [
  {
    key: "recruiter_now" as Lane,
    label: "Recruiter Now",
    icon: UserCheck,
    headerBg: "bg-primary/5",
    headerBorder: "border-primary/30",
    headerText: "text-primary",
    countBg: "bg-primary/10 text-primary",
    actionLabel: "View Profile",
    actionClass: "bg-primary text-primary-foreground hover:opacity-90",
    actionIcon: UserCheck,
  },
  {
    key: "quick_screen" as Lane,
    label: "Quick Screen",
    icon: Zap,
    headerBg: "bg-amber-50",
    headerBorder: "border-amber-300",
    headerText: "text-amber-700",
    countBg: "bg-amber-100 text-amber-700",
    actionLabel: "Start 3-min Screen",
    actionClass: "bg-amber-500 text-white hover:bg-amber-600",
    actionIcon: Play,
  },
  {
    key: "redirect" as Lane,
    label: "Redirect",
    icon: CornerDownRight,
    headerBg: "bg-slate-50",
    headerBorder: "border-slate-200",
    headerText: "text-slate-600",
    countBg: "bg-slate-100 text-slate-600",
    actionLabel: "Send Resources",
    actionClass: "bg-muted text-foreground hover:bg-muted/80 border border-border",
    actionIcon: CornerDownRight,
  },
];

// ─── Mock skill tags per candidate slot ───────────────────
const SKILL_SETS = [
  ["PyTorch", "Python"], ["Java", "Spring Boot"], ["Python", "R"],
  ["React", "TypeScript"], ["TensorFlow", "Python"], ["Excel", "SQL"],
  ["Go", "Kubernetes"], ["C++", "CUDA"], ["Spark", "Scala"],
];


// ─── Score Bar ────────────────────────────────────────────
function ScoreBar({ score, risk }: { score: number; risk: Risk }) {
  const color = risk === "high" ? "bg-amber-500" : risk === "medium" ? "bg-primary" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold text-foreground tabular-nums w-6">{score}</span>
    </div>
  );
}

// ─── Candidate Card ───────────────────────────────────────
function CandidateCard({
  candidate, index, lane,
}: {
  candidate: any; index: number; lane: typeof LANES[number];
}) {
  const risk: Risk = candidate.riskLevel === "high" ? "high" : candidate.riskLevel === "medium" ? "medium" : "low";
  const skills = SKILL_SETS[index % SKILL_SETS.length];
  const ActionIcon = lane.actionIcon;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={candidate.name} index={index} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{candidate.name}</p>
            <RiskBadge risk={risk} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{candidate.role ?? "Intern"}</p>
        </div>
      </div>

      {/* Score */}
      <div className="mb-3">
        <ScoreBar score={candidate.fitScore ?? 80} risk={risk} />
      </div>

      {/* Skills */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {skills.map(skill => (
          <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-medium">
            {skill}
          </span>
        ))}
      </div>

      {/* Action button */}
      <button className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl transition-all ${lane.actionClass}`}>
        <ActionIcon className="w-3.5 h-3.5" />
        {lane.actionLabel}
      </button>
    </div>
  );
}

// ─── Auto-Route Rules Panel ───────────────────────────────
function RulesPanel({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = useState([
    { id: 1, label: "Send new arrivals to Quick Screen unless Fit > 80", enabled: true },
    { id: 2, label: "Escalate if Screen score > threshold", enabled: true },
    { id: 3, label: "Auto-redirect if Risk = High + Fit < 75", enabled: false },
  ]);

  const insights = [
    "Aisha Patel is top-priority — route to recruiter immediately",
    "3 candidates in Quick Screen lane waiting > 5 min",
    "Redirect lane is growing — consider adjusting threshold",
  ];

  const toggle = (id: number) => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  return (
    <div className="w-[280px] shrink-0 border-l border-border bg-background flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Auto-Route Rules</h3>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Routing Rules */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Routing Rules</p>
          <div className="space-y-2.5">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-start gap-3 bg-card border border-border rounded-xl p-3">
                <button
                  onClick={() => toggle(rule.id)}
                  style={{ width: 34, height: 20, minWidth: 34 }}
                  className={`relative rounded-full transition-colors shrink-0 mt-0.5 ${rule.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span
                    style={{ width: 16, height: 16 }}
                    className={`absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform ${rule.enabled ? "translate-x-[14px]" : "translate-x-0"}`}
                  />
                </button>
                <p className="text-xs text-foreground leading-relaxed">{rule.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live Insights */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Live Insights</p>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-xl p-3 cursor-pointer hover:bg-primary/10 transition-colors">
                <Zap className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground flex-1 leading-relaxed">{insight}</p>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Live Fair Page ──────────────────────────────────
export default function LiveFairPage() {
  const trpc = useTRPC();
  const { data: candidates = [] } = useQuery(trpc.recruiter.getCandidates.queryOptions());
  const { data: activeEvent } = useQuery(trpc.recruiter.getActiveEvent.queryOptions());
  const { data: stats } = useQuery(trpc.recruiter.getDashboardStats.queryOptions());

  const [showRules, setShowRules] = useState(false);

  // Distribute candidates across lanes using their lane field or fallback by index
  const getLaneCandidates = (lane: Lane) => {
    const laned = candidates.filter(c => c.lane === lane);
    if (laned.length > 0) return laned;
    // Fallback: distribute by index for demo
    const all = [...candidates];
    if (lane === "recruiter_now") return all.filter((_, i) => i % 3 === 0).slice(0, 6);
    if (lane === "quick_screen") return all.filter((_, i) => i % 3 === 1).slice(0, 4);
    return all.filter((_, i) => i % 3 === 2).slice(0, 3);
  };

  const stats_pills = [
    { icon: Users, label: "Queue", value: stats?.inQueue ?? 8 },
    { icon: Clock, label: "Avg Wait", value: "4m" },
    { icon: Mic, label: "Screens", value: 3 },
    { icon: Users, label: "Recruiters", value: activeEvent?.recruiterCount ?? 5 },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] -mx-6 -mb-6 overflow-hidden">
      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-7 py-5 border-b border-border bg-background shrink-0">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">Live Fair</h1>
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {activeEvent?.name ?? "Tech Talent Expo 2026"} — Real-time control
              </p>
            </div>
            <button className="text-sm font-medium px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors">
              End Event
            </button>
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-4 gap-4">
            {stats_pills.map((pill, i) => (
              <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <pill.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{pill.value}</p>
                  <p className="text-xs text-muted-foreground">{pill.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lane headers + columns */}
        <div className="flex-1 overflow-hidden flex flex-col px-7 py-5 gap-4">
          {/* Lane header tabs */}
          <div className="grid grid-cols-3 gap-4 shrink-0">
            {LANES.map(lane => {
              const count = getLaneCandidates(lane.key).length;
              const LaneIcon = lane.icon;
              return (
                <div key={lane.key} className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 ${lane.headerBg} ${lane.headerBorder}`}>
                  <div className="flex items-center gap-2">
                    <LaneIcon className={`w-4 h-4 ${lane.headerText}`} />
                    <span className={`text-sm font-semibold ${lane.headerText}`}>{lane.label}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lane.countBg}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Candidate cards */}
          <div className="grid grid-cols-3 gap-4 flex-1 overflow-y-auto pb-2">
            {LANES.map(lane => (
              <div key={lane.key} className="flex flex-col gap-3">
                {getLaneCandidates(lane.key).map((candidate, i) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    index={i}
                    lane={lane}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Rules tab + panel ── */}
      <div className="flex shrink-0">
        {showRules && <RulesPanel onClose={() => setShowRules(false)} />}

        {/* Rules tab trigger */}
        {!showRules && (
          <button
            onClick={() => setShowRules(true)}
            className="w-10 flex flex-col items-center justify-center gap-1.5 bg-slate-800 text-white hover:bg-slate-700 transition-colors border-l border-slate-700"
          >
            <Shield className="w-4 h-4" />
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              Rules
            </span>
          </button>
        )}
      </div>
    </div>
  );
}