"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  Briefcase,
  Users,
  Activity,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";

// ─── Status Badge ────────────────────────────────────────
function StatusPill({ status }: { status: string | null }) {
  const styles: Record<string, string> = {
    // event
    live: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pre: "bg-blue-50 text-blue-700 border-blue-200",
    ended: "bg-muted text-muted-foreground border-border",
    // role status
    on_track: "bg-emerald-50 text-emerald-700 border-emerald-200",
    at_risk: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-red-50 text-red-700 border-red-200",
    // stage
    fair: "bg-muted text-muted-foreground border-border",
    screen: "bg-blue-50 text-blue-700 border-blue-200",
    interview: "bg-purple-50 text-purple-700 border-purple-200",
    offer: "bg-primary/10 text-primary border-primary/20",
    day1: "bg-emerald-50 text-emerald-700 border-emerald-200",
    // lane
    recruiter_now: "bg-primary/10 text-primary border-primary/20",
    quick_screen: "bg-amber-50 text-amber-700 border-amber-200",
    redirect: "bg-muted text-muted-foreground border-border",
    // risk
    low: "bg-emerald-50 text-emerald-700 border-emerald-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    high: "bg-red-50 text-red-700 border-red-200",
    // action status
    queued: "bg-blue-50 text-blue-700 border-blue-200",
    agent_active: "bg-purple-50 text-purple-700 border-purple-200",
    needs_approval: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };
  const cls = styles[status ?? ""] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium border capitalize ${cls}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

// ─── Copy ID Button ──────────────────────────────────────
function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      title={id}
    >
      {id.slice(0, 8)}...
      {copied ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Collapsible Section ─────────────────────────────────
function Section({
  title,
  icon: Icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-border hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{title}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && children}
    </div>
  );
}

// ─── Fit Score Bar ───────────────────────────────────────
function FitScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-primary" : score >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-2 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold text-foreground tabular-nums">{score}</span>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function DevDashboard() {
  const trpc = useTRPC();

  const { data: candidates, isLoading: loadingCandidates } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );
  const { data: roles, isLoading: loadingRoles } = useQuery(
    trpc.recruiter.getRoles.queryOptions()
  );
  const { data: events, isLoading: loadingEvents } = useQuery(
    trpc.recruiter.getEvents.queryOptions()
  );
  const { data: actions } = useQuery(
    trpc.recruiter.getActions.queryOptions()
  );

  const isLoading = loadingCandidates || loadingRoles || loadingEvents;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Summary stats
  const stageCounts = {
    fair: candidates?.filter(c => c.stage === "fair").length ?? 0,
    screen: candidates?.filter(c => c.stage === "screen").length ?? 0,
    interview: candidates?.filter(c => c.stage === "interview").length ?? 0,
    offer: candidates?.filter(c => c.stage === "offer").length ?? 0,
    day1: candidates?.filter(c => c.stage === "day1").length ?? 0,
  };

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dev Data</h1>
        <p className="text-sm text-muted-foreground">Raw seed data browser for development reference</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Events", value: events?.length ?? 0, icon: Calendar },
          { label: "Roles", value: roles?.length ?? 0, icon: Briefcase },
          { label: "Candidates", value: candidates?.length ?? 0, icon: Users },
          { label: "Actions", value: actions?.length ?? 0, icon: Activity },
          { label: "Avg Fit", value: candidates?.length ? Math.round(candidates.reduce((s, c) => s + (c.fitScore ?? 0), 0) / candidates.length) : 0, icon: ShieldCheck },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-xl px-4 py-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
              <card.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground tabular-nums">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Pipeline Distribution */}
      <div className="bg-card border border-border rounded-xl px-6 py-4 shadow-sm">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Pipeline Distribution</p>
        <div className="flex gap-2 h-6">
          {(["fair", "screen", "interview", "offer", "day1"] as const).map(stage => {
            const count = stageCounts[stage];
            const total = candidates?.length ?? 1;
            const pct = Math.max(2, Math.round((count / total) * 100));
            const colors: Record<string, string> = {
              fair: "bg-muted-foreground/40",
              screen: "bg-blue-500",
              interview: "bg-purple-500",
              offer: "bg-primary",
              day1: "bg-emerald-500",
            };
            return (
              <div
                key={stage}
                className={`${colors[stage]} rounded flex items-center justify-center text-[10px] font-medium text-white`}
                style={{ width: `${pct}%` }}
                title={`${stage}: ${count}`}
              >
                {count > 0 && count}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2">
          {(["fair", "screen", "interview", "offer", "day1"] as const).map(stage => {
            const dotColors: Record<string, string> = {
              fair: "bg-muted-foreground/40",
              screen: "bg-blue-500",
              interview: "bg-purple-500",
              offer: "bg-primary",
              day1: "bg-emerald-500",
            };
            return (
              <div key={stage} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dotColors[stage]}`} />
                <span className="text-[10px] text-muted-foreground capitalize">{stage === "day1" ? "Day 1" : stage}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events */}
      <Section title="Events" icon={Calendar} count={events?.length ?? 0}>
        <div className="grid grid-cols-2 gap-4 p-4">
          {events?.map(e => (
            <div key={e.id} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{e.name}</p>
                <StatusPill status={e.status} />
              </div>
              <p className="text-xs text-muted-foreground">{e.location}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{e.recruiterCount} recruiters</span>
                <span>{e.candidateCount} candidates</span>
              </div>
              <CopyId id={e.id} />
            </div>
          ))}
        </div>
      </Section>

      {/* Job Roles */}
      <Section title="Job Roles" icon={Briefcase} count={roles?.length ?? 0}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Title", "Department", "Target", "Needed", "Sent", "Accepted", "Status", "ID"].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold text-muted-foreground px-6 py-3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles?.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-3 text-sm font-medium text-foreground">{r.title}</td>
                <td className="px-6 py-3 text-xs text-muted-foreground">{r.department}</td>
                <td className="px-6 py-3 text-sm text-foreground tabular-nums">{r.targetHires}</td>
                <td className="px-6 py-3 text-sm text-foreground tabular-nums">{r.offersNeeded}</td>
                <td className="px-6 py-3 text-sm text-foreground tabular-nums">{r.offersSent}</td>
                <td className="px-6 py-3 text-sm text-foreground tabular-nums">{r.offersAccepted}</td>
                <td className="px-6 py-3"><StatusPill status={r.status} /></td>
                <td className="px-6 py-3"><CopyId id={r.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Candidates */}
      <Section title="Candidates" icon={Users} count={candidates?.length ?? 0}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Candidate", "Role", "Fit", "Risk", "Stage", "Lane", "Strengths", "Gaps", "ID"].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider first:pl-6 last:pr-6">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates?.map(c => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="pl-6 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {c.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate max-w-[140px]">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">{c.school}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.role}</td>
                <td className="px-4 py-3"><FitScoreBar score={c.fitScore ?? 0} /></td>
                <td className="px-4 py-3"><StatusPill status={c.riskLevel} /></td>
                <td className="px-4 py-3"><StatusPill status={c.stage} /></td>
                <td className="px-4 py-3"><StatusPill status={c.lane} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{c.strengths?.slice(0, 2).join(", ")}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{c.gaps?.slice(0, 2).join(", ")}</td>
                <td className="pr-6 px-4 py-3"><CopyId id={c.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Recruiter Actions */}
      <Section title="Recruiter Actions" icon={Activity} count={actions?.length ?? 0} defaultOpen={false}>
        {(actions?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Activity className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No actions recorded yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Action Type", "Status", "Notes", "Created", "ID"].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-muted-foreground px-6 py-3 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions?.map(a => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3"><StatusPill status={a.actionType} /></td>
                  <td className="px-6 py-3"><StatusPill status={a.status} /></td>
                  <td className="px-6 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{a.notes ?? "—"}</td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">{a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"}</td>
                  <td className="px-6 py-3"><CopyId id={a.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
