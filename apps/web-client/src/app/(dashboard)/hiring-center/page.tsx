"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  Send,
  CheckCircle,
  X,
  Pencil,
  Users,
  FileText,
  Activity,
  ChevronRight,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

/* ─── Mock Data ──────────────────────────────────────────────── */
const MOCK_APPROVALS = [
  {
    id: "1",
    priority: "HIGH PRIORITY" as const,
    category: "SHORTLIST",
    title: "Approve shortlist for Product Manager role",
    description:
      "AI ranked 3 candidates as strong matches (88–92% fit). Ready for interview scheduling.",
    metaIcon: "users" as const,
    meta1: "3 candidates",
    meta2: "Flagged 4 hours ago",
    editLabel: "Edit",
    highlighted: true,
  },
  {
    id: "2",
    priority: "HIGH PRIORITY" as const,
    category: "OFFER",
    title: "Approve offer letter draft for Sarah Chen",
    description:
      "Offer: $165K base + equity. Drafted based on compensation band and candidate expectations.",
    metaIcon: "file" as const,
    meta1: "Senior Software Engineer",
    meta2: "Flagged 1 hour ago",
    editLabel: "Edit Terms",
    highlighted: false,
  },
  {
    id: "3",
    priority: "MEDIUM PRIORITY" as const,
    category: "REJECTIONS",
    title: "Approve 12 auto-rejections for Software Engineer",
    description:
      "Candidates scored below 65% match threshold. System drafted rejection emails.",
    metaIcon: "users" as const,
    meta1: "12 candidates",
    meta2: "Flagged 6 hours ago",
    editLabel: "Review",
    highlighted: false,
  },
] as const;

const MOCK_ACTIVITY = [
  { label: "Pulled 24 new applicants", time: "2 minutes ago" },
  { label: "Flagged 2 skill mismatches", time: "5 minutes ago" },
];

/* ─── Stat Card ──────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: number;
  subtitle: string;
  accent?: boolean;
}) {
  return (
    <div
      className="flex flex-col justify-between flex-1 h-[111px] rounded-[14px] pt-4 pb-3 px-3"
      style={
        accent
          ? {
              background:
                "linear-gradient(-6.89deg, #1f6b43 9.75%, #0e3d27 73.23%)",
            }
          : { background: "#ffffff" }
      }
    >
      <div className="flex items-center justify-between w-full">
        <span
          className={`text-[13px] font-semibold leading-[19.5px] tracking-[-0.076px] whitespace-nowrap ${accent ? "text-white" : "text-[#111827]"}`}
        >
          {label}
        </span>
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${accent ? "bg-white" : "bg-white border border-[#0e3d27]"}`}
        >
          <ArrowUpRight className={`w-3.5 h-3.5 ${accent ? "text-[#0e3d27]" : "text-[#0e3d27]"}`} />
        </div>
      </div>
      <span
        className={`text-[32px] font-bold leading-[42px] tracking-[0.38px] ${accent ? "text-white" : "text-[#111827]"}`}
      >
        {value}
      </span>
      <span
        className={`text-[12px] font-normal leading-[16.5px] tracking-[0.065px] ${accent ? "text-[#abdd64]" : "text-[#6b7280]"}`}
      >
        {subtitle}
      </span>
    </div>
  );
}

/* ─── Approval Card ──────────────────────────────────────────── */
function ApprovalCard({
  priority,
  category,
  title,
  description,
  metaIcon,
  meta1,
  meta2,
  editLabel,
  highlighted,
}: {
  priority: "HIGH PRIORITY" | "MEDIUM PRIORITY";
  category: string;
  title: string;
  description: string;
  metaIcon: "users" | "file";
  meta1: string;
  meta2: string;
  editLabel: string;
  highlighted: boolean;
}) {
  const isHigh = priority === "HIGH PRIORITY";
  const MetaIcon = metaIcon === "file" ? FileText : Users;

  return (
    <div
      className={`rounded-[14px] p-4 space-y-2 w-full ${
        highlighted
          ? "bg-white border-2 border-[#1f6b43] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.04)]"
          : "bg-white border border-[#e2e8e5]"
      }`}
    >
      {/* Row 1: badges + action buttons */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          {/* Badges */}
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2.5 py-[3px] rounded-[6px] leading-[15px] tracking-[0.117px] whitespace-nowrap border ${
                isHigh
                  ? "bg-[#1f6b43] text-white border-white"
                  : "bg-[#fef3c7] text-[#92400e] border-transparent"
              }`}
            >
              {priority}
            </span>
            <span className="text-[10px] font-medium bg-[#f7f7f7] text-[#4b5563] px-2 py-[2px] rounded-[6px] leading-[15px] tracking-[0.117px]">
              {category}
            </span>
          </div>
          {/* Title */}
          <p className="text-[15px] font-semibold text-[#111827] leading-[22.5px] tracking-[-0.234px]">
            {title}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="h-[33px] px-[9px] rounded-[10px] border border-[#0e3d27] flex items-center gap-1 text-[12px] font-normal text-[#0e3d27] leading-[19.5px] tracking-[-0.076px] whitespace-nowrap hover:bg-[#e8f5ee] transition-colors">
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
          <button className="h-[33px] px-2 rounded-[10px] border border-[#6b7280] flex items-center gap-2 text-[12px] font-medium text-[#6b7280] leading-[18px] whitespace-nowrap hover:bg-gray-50 transition-colors">
            <Pencil className="w-4 h-4" />
            {editLabel}
          </button>
          <button className="h-9 w-[42px] rounded-[10px] border border-[#6b7280] flex items-center justify-center text-[#6b7280] hover:bg-gray-50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-[13px] font-normal text-[#4b5563] leading-[19.5px] tracking-[-0.076px]">
        {description}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-3 text-[12px] text-[#4b5563] leading-[18px]">
        <div className="flex items-center gap-[18px]">
          <MetaIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{meta1}</span>
        </div>
        <span>•</span>
        <span>{meta2}</span>
      </div>
    </div>
  );
}

/* ─── Approval Breakdown Donut ───────────────────────────────── */
const DONUT_DATA = [
  { name: "Interviews", pct: "40%", value: 40, color: "#6fbf9a" },
  { name: "Rejections", pct: "30%", value: 30, color: "#2e8b57" },
  { name: "Scheduling", pct: "20%", value: 20, color: "#1f6b43" },
  { name: "Offers",     pct: "10%", value: 10, color: "#e2e8e5", striped: true },
];

function ApprovalBreakdown({ total }: { total: number }) {
  return (
    <div className="bg-white rounded-[14px] p-4 flex flex-col gap-6 items-center">
      {/* Title — full width */}
      <h3 className="text-[14px] font-semibold text-[#111827] leading-[21px] w-full">
        Approval Breakdown
      </h3>

      {/* Half-donut + label below the arc opening */}
      <div className="flex flex-col items-center" style={{ width: 240 }}>
        <div style={{ width: 240, height: 120 }}>
          <ResponsiveContainer width={240} height={120}>
            <PieChart>
              <Pie
                data={DONUT_DATA}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={44}
                outerRadius={76}
                dataKey="value"
                strokeWidth={2}
                stroke="#ffffff"
              >
                {DONUT_DATA.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Label sits just below the arc opening (pulled up with negative margin) */}
        <div
          className="flex flex-col items-center text-center"
          style={{ marginTop: -28 }}
        >
          <span
            className="font-bold text-[#111827]"
            style={{ fontSize: 30, lineHeight: "36px", letterSpacing: "0.1px" }}
          >
            {total}
          </span>
          <span
            className="font-normal text-[#1f6b43]"
            style={{ fontSize: 14, lineHeight: "20px", letterSpacing: "0.09px" }}
          >
            Total
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-3 w-full">
        {DONUT_DATA.map((d) => (
          <div key={d.name} className="flex items-center justify-between h-[19.5px]">
            <div className="flex items-center gap-2">
              {d.striped ? (
                <div
                  className="w-3 h-3 rounded-full shrink-0 overflow-hidden"
                  style={{
                    background: "#e2e8e5",
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, #4b5563 0px, #4b5563 2px, transparent 2px, transparent 4px)",
                  }}
                />
              ) : (
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              )}
              <span className="text-[13px] font-normal text-[#4b5563] leading-[19.5px] whitespace-nowrap">
                {d.name}
              </span>
            </div>
            <span className="text-[13px] font-semibold text-[#111827] leading-[19.5px] whitespace-nowrap">
              {d.pct}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Agent Activity ─────────────────────────────────────────── */
function AgentActivity({
  items,
}: {
  items: { label: string; time: string }[];
}) {
  return (
    <div className="bg-white rounded-[14px] p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pr-[37.82px]">
        <div className="flex flex-col gap-1">
          <h3
            className="font-bold text-[#111827] whitespace-nowrap"
            style={{ fontSize: 18, lineHeight: "27px", letterSpacing: "-0.4395px" }}
          >
            Agent Activity
          </h3>
          <p
            className="font-normal text-[#4b5563] whitespace-nowrap"
            style={{ fontSize: 12, lineHeight: "18px" }}
          >
            Actions executed automatically by the system.
          </p>
        </div>
      </div>

      {/* Activity items */}
      <div className="flex flex-col gap-3 overflow-hidden">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 border-b border-[#f7f7f7] pb-px"
            style={{ height: 58.5 }}
          >
            {/* Icon container — rounded-[10px] per Figma, NOT rounded-full */}
            <div className="w-8 h-8 rounded-[10px] bg-[#e8f5ee] flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-[#0e3d27]" />
            </div>
            <div className="relative flex-1 min-w-0" style={{ height: 45.5 }}>
              <p
                className="absolute top-px left-0 font-normal text-[#111827] whitespace-nowrap"
                style={{ fontSize: 13, lineHeight: "19.5px", letterSpacing: "-0.0762px" }}
              >
                {item.label}
              </p>
              <p
                className="absolute left-0 font-normal text-[#4b5563] whitespace-nowrap"
                style={{ top: 26, fontSize: 11, lineHeight: "16.5px", letterSpacing: "0.0645px" }}
              >
                {item.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* View Full Log button — matches Figma layout exactly */}
      <div className="relative h-9 w-full rounded-[14px] border border-[#e2e8e5] bg-white hover:bg-[#f7f7f7] transition-colors cursor-pointer">
        <ChevronRight
          className="absolute top-[9px] text-[#4b5563]"
          style={{ left: 70.98, width: 16, height: 16 }}
        />
        <p
          className="absolute font-medium text-[#4b5563] text-center whitespace-nowrap"
          style={{
            fontSize: 13,
            lineHeight: "19.5px",
            letterSpacing: "-0.0762px",
            top: 8.25,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          View Full Log
        </p>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function HiringCenterPage() {
  const trpc = useTRPC();
  const { user } = useUser();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery(trpc.recruiter.getDashboardStats.queryOptions());
  const { data: actions } = useQuery(trpc.recruiter.getActions.queryOptions());
  const { data: candidates } = useQuery(trpc.recruiter.getCandidates.queryOptions());

  const firstName = user?.firstName ?? "Sarah";

  const now = new Date();
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "long" });
  const dayNum = now.getDate();

  const totalCandidates = stats?.totalCandidates ?? 24;
  const inInterview = stats?.inInterview ?? 3;
  const offers = stats?.offers ?? 1;
  const flagged = candidates?.filter((c) => c.riskLevel === "high").length ?? 2;
  const autoScreened = candidates?.filter((c) => (c.fitScore ?? 0) < 65).length ?? 6;

  const approvalActions = actions?.filter(
    (a) => a.status === "needs_approval" || a.status === "queued"
  ) ?? [];
  const completedActions = actions?.filter((a) => a.status === "success") ?? [];

  const activityItems =
    completedActions.length > 0
      ? completedActions.slice(0, 2).map((a) => ({
          label:
            a.actionType === "sync_to_ats"
              ? "Synced to ATS"
              : a.actionType === "follow_up_email"
              ? "Sent follow-up email"
              : a.actionType === "schedule_interview"
              ? "Scheduled interview"
              : "Moved stage",
          time: new Date(a.createdAt ?? Date.now()).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        }))
      : MOCK_ACTIVITY;

  if (statsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Failed to load dashboard data. Please refresh.</p>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#1f6b43] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ══ Top Card: Header + Date/Tasks + Insights ══ */}
      <div className="bg-[#f7f7f7] rounded-2xl shadow-[0px_1px_4px_0px_rgba(0,0,0,0.05)] px-4 py-5 flex flex-col gap-6 shrink-0">

        {/* Row 1: Greeting + Buttons */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <h1 className="text-[32px] font-bold text-[#111827] leading-10 tracking-[0.406px]">
              Hi {firstName}!
            </h1>
            <p className="text-[14px] font-normal text-[#4b5563] leading-5 tracking-[-0.15px] whitespace-nowrap">
              Your AI-powered hiring copilot. Ask questions, review insights, and take action.
            </p>
          </div>
          <Link href="/roles/new/alignment">
            <button
              className="flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.15px] whitespace-nowrap"
              style={{
                background:
                  "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)",
              }}
            >
              <span className="text-[22px] font-light leading-5 w-[15px]">+</span>
              Add  New Position
            </button>
          </Link>
          <button className="flex items-center justify-center h-10 px-[17px] py-[13px] rounded-[14px] border border-[#0e3d27] shadow-[0px_4px_12px_0px_rgba(46,139,87,0.25)] text-[14px] font-medium text-[#4b5563] leading-5 whitespace-nowrap hover:bg-[#f0faf4] transition-colors">
            Import data
          </button>
        </div>

        {/* Row 2: Date + Tasks | Insights */}
        <div className="flex items-center justify-between w-full">
          {/* Left: Date + Tasks */}
          <div className="flex items-center gap-20">
            <div className="flex items-center gap-4 border-r border-[#e2e8e5] pr-[33px]">
              <div className="w-[60px] h-[60px] rounded-full border border-[#e2e8e5] flex items-center justify-center">
                <span className="text-[28px] font-medium text-[#111827] leading-10 tracking-[0.371px]">
                  {dayNum}
                </span>
              </div>
              <div className="flex flex-col text-[14px] font-medium text-[#111827] leading-[21px] tracking-[-0.15px] whitespace-nowrap">
                <span>{dayOfWeek},</span>
                <span>{month}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.15px] whitespace-nowrap"
                style={{
                  background:
                    "linear-gradient(171.26deg, #0e3d27 16.33%, #1f6b43 71.81%)",
                }}
              >
                Show my Tasks
                <ArrowUpRight className="w-[18px] h-[14px]" />
              </button>
              <button className="w-10 h-10 rounded-[10px] border border-[#e2e8e5] flex items-center justify-center text-[#4b5563] hover:bg-[#e2e8e5] transition-colors">
                <Calendar className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right: Insights */}
          <div className="flex items-center gap-[60px] pr-[60px]">
            <div className="flex flex-col gap-1 w-[365px]">
              <p className="text-[24px] font-medium text-[#0e3d27] leading-8 tracking-[0.07px] whitespace-nowrap">
                Need help with insights?
              </p>
              <p className="text-[18px] font-normal text-[#9ca3af] tracking-[-0.15px] leading-5">
                <span className="text-[#4b5563]">|</span>
                <span> Ask for insights, actions, or updates across your open roles.</span>
              </p>
            </div>
            <button className="w-[60px] h-[60px] rounded-full border border-[#0e3d27] bg-[#f7f7f7] flex items-center justify-center hover:bg-[#e8f5ee] transition-colors">
              <Send className="w-5 h-5 text-[#0e3d27]" />
            </button>
          </div>
        </div>
      </div>

      {/* ══ Bottom Card: Stats + Content ══ */}
      <div className="bg-[#f7f7f7] rounded-2xl shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] px-4 py-5 flex flex-col gap-12 flex-1 overflow-y-auto">

        {/* Stat Cards Row */}
        <div className="flex flex-wrap gap-4 w-full">
          <StatCard label="New applicants"    value={totalCandidates} subtitle="Processed & screened" accent />
          <StatCard label="Moved to Interview" value={inInterview}     subtitle="Auto-advanced" />
          <StatCard label="Auto-screened out"  value={autoScreened}    subtitle="Below threshold" />
          <StatCard label="Flagged issues"     value={flagged}         subtitle="Need attention" />
          <StatCard label="Offer drafted"      value={offers}          subtitle="Ready to send" />
        </div>

        {/* Approvals + Sidebar */}
        <div className="flex gap-6 items-start">

          {/* Left: Pending Approvals */}
          <div className="bg-white rounded-[14px] p-4 flex flex-col gap-4 flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between h-[53.5px]">
              <div className="flex flex-col gap-1">
                <h2 className="text-[20px] font-bold text-[#111827] leading-[30px] tracking-[-0.449px] whitespace-nowrap">
                  Pending Approvals
                </h2>
                <p className="text-[13px] font-normal text-[#4b5563] leading-[19.5px] tracking-[-0.076px] whitespace-nowrap">
                  Decisions awaiting your confirmation.
                </p>
              </div>
              <button className="bg-[#1f6b43] text-white text-[12px] font-normal leading-[19.5px] tracking-[-0.076px] px-4 py-3 rounded-[10px] whitespace-nowrap hover:bg-[#0e3d27] transition-colors">
                Review All ({approvalActions.length || 18})
              </button>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-3">
              {MOCK_APPROVALS.map((a) => (
                <ApprovalCard key={a.id} {...a} />
              ))}
            </div>
          </div>

          {/* Right: Breakdown + Activity */}
          <div className="flex flex-col gap-6 w-[338px] shrink-0">
            <ApprovalBreakdown total={approvalActions.length || 18} />
            <AgentActivity items={activityItems} />
          </div>
        </div>
      </div>
    </div>
  );
}
