"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Clock, Calendar, Target, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, ChevronRight, BarChart3, Zap,
  Activity, UserPlus, Shuffle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
  LineChart, Line, Tooltip,
} from "recharts";

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    on_track: { label: "On Track", icon: CheckCircle, cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    at_risk: { label: "At Risk", icon: AlertTriangle, cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    critical: { label: "Critical", icon: AlertTriangle, cls: "bg-red-50 text-red-700 border border-red-200" },
  };
  const s = map[status ?? "on_track"] ?? map.on_track;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
      <s.icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

// ─── Coverage Bar ─────────────────────────────────────────
function CoverageBar({ sent, needed }: { sent: number; needed: number }) {
  const pct = needed === 0 ? 0 : Math.min(100, Math.round((sent / needed) * 100));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{sent}/{needed}</span>
    </div>
  );
}

// ─── Sparkline SVG ────────────────────────────────────────
function Sparkline({ status }: { status: string | null }) {
  const color = status === "on_track" ? "#2d6a4f" : status === "critical" ? "#c53030" : "#b7791f";
  const points = status === "critical"
    ? "0,6 15,8 30,12 45,16 60,20"
    : status === "at_risk"
    ? "0,14 15,12 30,16 45,10 60,8"
    : "0,20 15,14 30,10 45,6 60,4";
  return (
    <svg viewBox="0 0 60 24" className="w-16 h-6">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Delta ────────────────────────────────────────────────
function Delta({ value, positive }: { value: string; positive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? "text-emerald-600" : "text-red-500"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {value}
    </span>
  );
}

// ─── Util Bar ─────────────────────────────────────────────
function UtilBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const sparkData = [{ v: 4 }, { v: 6 }, { v: 5 }, { v: 8 }, { v: 7 }, { v: 9 }, { v: 11 }];
const funnelData = [
  { stage: "Registered", count: 80 },
  { stage: "Screened", count: 54 },
  { stage: "Interviewed", count: 24 },
  { stage: "Offer", count: 9 },
  { stage: "Accepted", count: 4 },
];
const funnelDrops = ["", "-33%", "-55%", "-64%", "-56%"];

export default function RecruiterDashboard() {
  const trpc = useTRPC();
  const { data: stats, isLoading } = useQuery(trpc.recruiter.getDashboardStats.queryOptions());
  const { data: activeEvent } = useQuery(trpc.recruiter.getActiveEvent.queryOptions());
  const { data: candidates } = useQuery(trpc.recruiter.getCandidates.queryOptions());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">

      {/* ── Row 1: Live Banner + Stat Pills ── */}
      <div className="flex gap-5 items-stretch">
        {activeEvent && (
          <div className="relative flex items-center gap-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5 min-w-[300px] shadow-md overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #14b8a6 0%, transparent 60%)" }} />
            <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 z-10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="z-10 flex-1 min-w-0">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full w-fit mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
              <p className="text-white font-semibold text-sm truncate">{activeEvent.name}</p>
              <p className="text-slate-400 text-xs mt-1">
                {stats?.inQueue ?? 0} queued · {candidates?.filter(c => c.stage === "screen").length ?? 0} screens · {activeEvent.recruiterCount} recruiters
              </p>
            </div>
            <button className="z-10 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        <div className="flex-1 grid grid-cols-4 gap-4">
          {[
            { label: "QUEUE / WAIT", value: `${stats?.inQueue ?? 8}`, sub: "in queue", sub2: "4m avg", icon: Clock },
            { label: "RECRUITERS", value: `${activeEvent?.recruiterCount ?? 5}`, sub: "online", sub2: "72% util.", icon: Users },
            { label: "INTERVIEWS", value: `${stats?.inInterview ?? 22}`, sub: "/day", sub2: "6 today", icon: Calendar },
            { label: "PROJ. HIRES", value: `${stats?.projectedHires ?? 7}`, sub: `/ ${stats?.roles?.reduce((a, r) => a + (r.targetHires ?? 0), 0) ?? 21}`, sub2: "50% rate", icon: Target, badge: true },
          ].map((card) => (
            <div key={card.label} className="bg-card border border-border rounded-2xl px-5 py-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <card.icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-foreground tabular-nums">{card.value}</span>
                <span className="text-sm text-muted-foreground">{card.sub}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{card.sub2}</span>
                {card.badge && (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    Low conf.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 2: Roles Progress Table ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-7 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-foreground">Roles Progress</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats?.roles?.length ?? 0} reqs · {stats?.roles?.reduce((acc, r) => acc + (r.targetHires ?? 0), 0) ?? 0} total HC
              </p>
            </div>
          </div>
          <select className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
            <option>All Roles</option>
          </select>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {["Role", "HC", "Offers Needed", "Sent", "Accepted", "Pipeline Coverage", "Status", "Projection"].map(h => (
                <th key={h} scope="col" className="text-left text-[10px] font-semibold text-muted-foreground px-7 py-3.5 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats?.roles?.map((role) => (
              <tr key={role.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-7 py-4">
                  <p className="text-sm font-medium text-foreground">{role.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{role.department}</p>
                </td>
                <td className="px-7 py-4 text-sm text-foreground tabular-nums">{role.targetHires}</td>
                <td className="px-7 py-4 text-sm text-foreground tabular-nums">{role.offersNeeded}</td>
                <td className="px-7 py-4 text-sm text-foreground tabular-nums">{role.offersSent}</td>
                <td className="px-7 py-4 text-sm text-foreground tabular-nums">{role.offersAccepted}</td>
                <td className="px-7 py-4 w-44">
                  <CoverageBar sent={role.offersSent ?? 0} needed={role.offersNeeded ?? 1} />
                </td>
                <td className="px-7 py-4">
                  <StatusBadge status={role.status} />
                </td>
                <td className="px-7 py-4">
                  <Sparkline status={role.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Row 3: Stage Movement + Conversion Funnel ── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Stage Movement */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Stage Movement</p>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">last 24h</span>
            </div>
            <div className="w-24 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <Line type="monotone" dataKey="v" stroke="#14b8a6" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Verified", value: "+12", color: "text-emerald-600", bg: "bg-emerald-50 border border-emerald-100" },
              { label: "Screens Done", value: "+9", color: "text-amber-600", bg: "bg-amber-50 border border-amber-100" },
              { label: "Interviews Sched.", value: "+6", color: "text-purple-600", bg: "bg-purple-50 border border-purple-100" },
              { label: "Offers Sent", value: "+2", color: "text-blue-600", bg: "bg-blue-50 border border-blue-100" },
            ].map((item, i) => (
              <div key={i} className={`${item.bg} rounded-xl p-4`}>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Conversion Funnel</p>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} barSize={38} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {funnelData.map((_, i) => (
                    <Cell key={i} fill="#14b8a6" opacity={1 - i * 0.15} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around mt-1">
            {funnelDrops.map((drop, i) => (
              <span key={i} className="text-[10px] font-semibold text-red-500 w-[20%] text-center">{drop}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Recruiter Productivity ── */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Recruiter Productivity</p>
        </div>
        <div className="grid grid-cols-4 gap-0 divide-x divide-border">
          {[
            { label: "Convs / Recruiter / Hr", value: "4.2", delta: "+0.8", positive: true },
            { label: "High-Signal Conversion", value: "62%", delta: "+5pp", positive: true },
            { label: "Follow-up SLA (24h)", value: "88%", delta: "-3pp", positive: false },
            { label: "ATS Sync Completion", value: "94%", delta: "+2pp", positive: true },
          ].map((metric, i) => (
            <div key={i} className={`${i > 0 ? "pl-8" : ""} ${i < 3 ? "pr-8" : ""}`}>
              <p className="text-xs text-muted-foreground mb-2">{metric.label}</p>
              <div className="flex items-end gap-2.5">
                <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                <div className="mb-1">
                  <Delta value={metric.delta} positive={metric.positive} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 5: Pipeline Health + Real-time Operations ── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Pipeline Health */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Pipeline Health</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { value: "5", label: "Interview-Ready" },
              { value: "6", label: "Sched. (7d)" },
              { value: "25%", label: "Screen→Int. drop" },
            ].map((s, i) => (
              <div key={i} className="bg-muted/40 border border-border/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4 mb-5">
            {[
              { label: "Screen → Interview", pct: 25 },
              { label: "Interview → Offer", pct: 38 },
            ].map((bar, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground">{bar.label}</p>
                  <p className="text-xs font-semibold text-foreground">{bar.pct}%</p>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${bar.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Median Time in Stage
            </p>
            <div className="space-y-2.5">
              {[
                { stage: "Screen", days: "1.2d", pct: 30 },
                { stage: "Interview", days: "2.8d", pct: 56 },
                { stage: "Offer", days: "3.1d", pct: 62 },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground w-16 shrink-0">{s.stage}</p>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${s.pct}%` }} />
                  </div>
                  <p className="text-xs font-semibold text-foreground w-8 text-right">{s.days}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Real-time Operations */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <p className="text-sm font-semibold text-foreground">Real-time Operations</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Recruiter Now", queue: 3, wait: "2m", util: 85, utilColor: "bg-emerald-500" },
              { label: "Quick Screen", queue: 6, wait: "7m", util: 92, utilColor: "bg-amber-500" },
              { label: "Redirect", queue: 2, wait: "1m", util: 40, utilColor: "bg-primary" },
            ].map((col, i) => (
              <div key={i} className="bg-muted/40 border border-border/50 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-muted-foreground mb-3">{col.label}</p>
                <p className="text-[10px] text-muted-foreground">Queue</p>
                <p className="text-xl font-bold text-foreground">{col.queue}</p>
                <p className="text-[10px] text-muted-foreground mt-2">Avg Wait</p>
                <p className="text-sm font-semibold text-foreground">{col.wait}</p>
                <UtilBar pct={col.util} color={col.utilColor} />
                <p className="text-[10px] text-muted-foreground mt-1">{col.util}% util.</p>
              </div>
            ))}
          </div>

          <div className="bg-muted/40 border border-border/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Recruiter Capacity</p>
                <p className="text-sm font-semibold text-foreground">
                  5 × 5/hr = <span className="text-primary font-bold">25 convos/hr</span>
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
            </div>
          </div>

          <div className="mt-auto bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-medium text-amber-800">Quick Screen backing up (6 in queue)</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">
                <UserPlus className="w-3 h-3" />
                Add recruiter
              </button>
              <button className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors whitespace-nowrap">
                <Shuffle className="w-3 h-3" />
                Auto-route
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}