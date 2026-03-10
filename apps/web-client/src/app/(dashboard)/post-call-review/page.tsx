"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, type ComponentType } from "react";
import {
  Search,
  ChevronDown,
  Download,
  Mail,
  CheckCircle2,
  Clock,
  Calendar,
  FileText,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Pause,
  Sparkles,
  Send,
  RotateCcw,
  Users,
  TrendingUp,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { getInitials } from "@/lib/recruiter-utils";

/* ─── Types ──────────────────────────────────────────────────── */
type Candidate = {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  role: string | null;
  roleId: string | null;
  fitScore: number | null;
  stage: string | null;
  riskLevel: string | null;
  strengths: unknown;
  gaps: unknown;
  summary: string | null;
  avatarUrl: string | null;
  verified: boolean | null;
};

type FollowUpStatus = "drafted" | "sent" | "scheduled" | "pending";
type Impression = "excellent" | "strong" | "good" | "needs-review";
type EmailTemplate = "interview" | "thankyou" | "rejection" | "hold";

/* ─── Helpers ────────────────────────────────────────────────── */
const FOLLOW_UP_STATUSES: FollowUpStatus[] = ["sent", "scheduled", "drafted", "pending"];
const IMPRESSIONS: Impression[] = ["excellent", "strong", "good", "needs-review"];

const getFollowUpStatus = (i: number): FollowUpStatus => FOLLOW_UP_STATUSES[i % FOLLOW_UP_STATUSES.length];
const getImpression = (score: number): Impression => {
  if (score >= 85) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 65) return "good";
  return "needs-review";
};

const IMPRESSION_CONFIG: Record<Impression, { label: string; bg: string; text: string; border: string }> = {
  excellent: { label: "Excellent", bg: "#e8f5ee", text: "#0e3d27", border: "#c5e4d1" },
  strong:    { label: "Strong",    bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  good:      { label: "Good",      bg: "#fefce8", text: "#854d0e", border: "#fde68a" },
  "needs-review": { label: "Review",  bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
};

const FOLLOW_UP_CONFIG: Record<FollowUpStatus, { icon: ComponentType<{ className?: string }>; label: string; color: string }> = {
  sent:      { icon: CheckCircle2, label: "Sent",      color: "#1f6b43" },
  scheduled: { icon: Calendar,     label: "Scheduled", color: "#6b7280" },
  drafted:   { icon: FileText,     label: "Drafted",   color: "#92400e" },
  pending:   { icon: Clock,        label: "Pending",   color: "#92400e" },
};

const EMAIL_TEMPLATES: Record<EmailTemplate, { label: string; subject: (name: string, role: string) => string; body: (name: string, role: string, strength?: string) => string }> = {
  interview: {
    label: "Interview Invite",
    subject: (name: string, role: string) => `Interview Invitation — ${role}`,
    body: (name, role) =>
      `Hi ${name},\n\nThank you for meeting with us at Tech Talent Expo 2026. We were very impressed with your background and would love to continue the conversation.\n\nWe'd like to invite you to a formal interview for the ${role} position. Please let us know your availability this week or next.\n\nBest regards,\nThe Recruiting Team`,
  },
  thankyou: {
    label: "Thank You + Hold",
    subject: (name: string, role: string) => `Thank You — ${role} Opportunity`,
    body: (name, role, strength) =>
      `Hi ${name},\n\nThank you for stopping by our booth at Tech Talent Expo 2026${strength ? ` and for sharing your experience in ${strength}` : ""}.\n\nWe are still evaluating candidates for the ${role} position and will be in touch soon with next steps.\n\nBest regards,\nThe Recruiting Team`,
  },
  rejection: {
    label: "Rejection",
    subject: (name: string, role: string) => `Update on Your Application — ${role}`,
    body: (name, role) =>
      `Hi ${name},\n\nThank you for your interest in the ${role} position and for taking the time to meet with us at Tech Talent Expo 2026.\n\nAfter careful consideration, we have decided to move forward with other candidates at this time. We appreciate your time and encourage you to apply for future openings.\n\nBest of luck,\nThe Recruiting Team`,
  },
  hold: {
    label: "Custom",
    subject: (name: string, role: string) => `Following Up — ${role} at Tech Talent Expo`,
    body: (name, role, strength) =>
      `Hi ${name},\n\nThank you for connecting with us at Tech Talent Expo 2026. We were impressed by your background${strength ? `, especially your experience in ${strength}` : ""}.\n\nWe'd love to continue the conversation about the ${role} position. Please feel free to reach out with any questions.\n\nBest regards,\nThe Recruiting Team`,
  },
};


function getStrengths(c: Candidate): string[] {
  if (Array.isArray(c.strengths)) return (c.strengths as string[]).slice(0, 3);
  return [];
}

function getGaps(c: Candidate): string[] {
  if (Array.isArray(c.gaps)) return (c.gaps as string[]).slice(0, 2);
  return [];
}

function formatEmail(c: Candidate): string {
  return c.email ?? `${c.name.toLowerCase().replace(/\s+/g, ".")}@email.com`;
}

/* ─── Stat Pill ──────────────────────────────────────────────── */
function StatPill({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 border border-border rounded-xl px-4 py-3 flex-1 ${accent ? "bg-[#0e3d27]" : "bg-card"}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-white/10" : "bg-[#e8f5ee]"}`}>
        <Icon className={`w-4 h-4 ${accent ? "text-white" : "text-[#0e3d27]"}`} />
      </div>
      <div>
        <p className={`text-[10px] uppercase tracking-wide font-medium leading-none mb-1 ${accent ? "text-white/60" : "text-muted-foreground"}`}>
          {label}
        </p>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-bold leading-none ${accent ? "text-white" : "text-foreground"}`}>{value}</span>
          {sub && <span className={`text-xs ${accent ? "text-white/60" : "text-muted-foreground"}`}>{sub}</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Impression Badge ───────────────────────────────────────── */
function ImpressionBadge({ impression }: { impression: Impression }) {
  const cfg = IMPRESSION_CONFIG[impression];
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

/* ─── Follow-up Badge ────────────────────────────────────────── */
function FollowUpBadge({ status }: { status: FollowUpStatus }) {
  const cfg = FOLLOW_UP_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: cfg.color }}>
      <cfg.icon className="w-3 h-3 shrink-0" />
      {cfg.label}
    </span>
  );
}

/* ─── Candidate Row ──────────────────────────────────────────── */
function CandidateRow({
  candidate,
  followUpStatus,
  isSelected,
  onClick,
}: {
  candidate: Candidate;
  followUpStatus: FollowUpStatus;
  isSelected: boolean;
  onClick: () => void;
}) {
  const score = candidate.fitScore ?? 0;
  const impression = getImpression(score);
  const impCfg = IMPRESSION_CONFIG[impression];

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 cursor-pointer transition-colors ${
        isSelected ? "bg-[#e8f5ee]/40 border-l-2 border-l-[#0e3d27]" : "hover:bg-muted/20"
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {candidate.avatarUrl ? (
          <img src={candidate.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ background: impCfg.bg, color: impCfg.text }}
          >
            {getInitials(candidate.name)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{candidate.name}</span>
          <ImpressionBadge impression={impression} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {candidate.role ?? "—"} · {candidate.school ?? "University"}
        </p>
      </div>

      {/* Score */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold shadow-sm"
        style={
          score >= 85
            ? { background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)", color: "#fff" }
            : { background: "#f7f7f7", color: "#0e3d27" }
        }
      >
        {score}
      </div>

      {/* Follow-up */}
      <div className="w-20 shrink-0 flex justify-end">
        <FollowUpBadge status={followUpStatus} />
      </div>

      {/* Chevron */}
      <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${isSelected ? "text-[#0e3d27]" : "text-muted-foreground/40"}`} />
    </div>
  );
}

/* ─── Review Panel ───────────────────────────────────────────── */
function ReviewPanel({
  candidate,
  followUpStatus,
  onClose,
}: {
  candidate: Candidate;
  followUpStatus: FollowUpStatus;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState<EmailTemplate>("interview");
  const [editingEmail, setEditingEmail] = useState(false);

  const score = candidate.fitScore ?? 0;
  const impression = getImpression(score);
  const impCfg = IMPRESSION_CONFIG[impression];
  const strengths = getStrengths(candidate);
  const gaps = getGaps(candidate);
  const role = candidate.role ?? "this position";
  const firstName = candidate.name.split(" ")[0];
  const strength0 = strengths[0];

  const emailBody = EMAIL_TEMPLATES[template].body(firstName, role, strength0);
  const emailSubject = EMAIL_TEMPLATES[template].subject(candidate.name, role);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {candidate.avatarUrl ? (
              <img src={candidate.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ background: impCfg.bg, color: impCfg.text }}
              >
                {getInitials(candidate.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight truncate">{candidate.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow-sm"
              style={
                score >= 85
                  ? { background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)", color: "#fff" }
                  : { background: "#f7f7f7", color: "#0e3d27" }
              }
            >
              {score}%
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImpressionBadge impression={impression} />
          <FollowUpBadge status={followUpStatus} />
        </div>
      </div>

      {/* AI Notes */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-[#1f6b43]" />
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">AI Review Notes</span>
        </div>

        {candidate.summary ? (
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {candidate.summary.slice(0, 160)}{candidate.summary.length > 160 && "…"}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Strong candidate with relevant technical background. Demonstrated enthusiasm for the role and good communication skills during the career fair conversation.
          </p>
        )}

        {strengths.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {strengths.map((s, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-[#e8f5ee] text-[#0e3d27] font-medium border border-[#c5e4d1]">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {gaps.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Gaps</p>
            <div className="flex flex-wrap gap-1.5">
              {gaps.map((g, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-200">
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Decision */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-[11px] font-bold text-foreground uppercase tracking-wide mb-3">Decision</p>
        <div className="flex flex-col gap-2">
          <button
            className="w-full h-9 rounded-[14px] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
            onClick={() => setTemplate("interview")}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            Advance to Interview
          </button>
          <div className="flex gap-2">
            <button
              className="flex-1 h-8 rounded-lg border border-border bg-card text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors"
              onClick={() => setTemplate("thankyou")}
            >
              <Pause className="w-3 h-3" />
              Hold
            </button>
            <button
              className="flex-1 h-8 rounded-lg border border-border bg-card text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              onClick={() => setTemplate("rejection")}
            >
              <ThumbsDown className="w-3 h-3" />
              Pass
            </button>
          </div>
        </div>
      </div>

      {/* Email section */}
      <div className="px-5 py-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#1f6b43]" />
            <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">Follow-up Email</span>
          </div>
          <button
            onClick={() => setEditingEmail(!editingEmail)}
            className="text-[10px] font-medium text-[#1f6b43] hover:underline"
          >
            {editingEmail ? "Preview" : "Edit"}
          </button>
        </div>

        {/* Template selector */}
        <div className="flex gap-1 flex-wrap mb-3">
          {(Object.keys(EMAIL_TEMPLATES) as EmailTemplate[]).map((t) => (
            <button
              key={t}
              onClick={() => setTemplate(t)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                template === t
                  ? "bg-[#0e3d27] text-white border-[#0e3d27]"
                  : "bg-card text-muted-foreground border-border hover:border-[#1f6b43] hover:text-[#1f6b43]"
              }`}
            >
              {EMAIL_TEMPLATES[t].label}
            </button>
          ))}
        </div>

        {/* Email preview */}
        <div className="bg-muted/30 rounded-xl border border-border p-3 space-y-2.5 text-xs">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">To</p>
            <p className="text-foreground">{formatEmail(candidate)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Subject</p>
            <p className="text-foreground">{emailSubject}</p>
          </div>
          <div className="border-t border-border pt-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Body</p>
            <p className="text-foreground leading-relaxed whitespace-pre-line text-[11px]">{emailBody}</p>
          </div>
        </div>
      </div>

      {/* Send actions */}
      <div className="px-5 py-4 border-t border-border flex gap-2">
        <button
          className="flex-1 h-9 rounded-[14px] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
        >
          <Send className="w-3.5 h-3.5" />
          Send Now
        </button>
        <button className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1 hover:bg-muted transition-colors">
          <Calendar className="w-3.5 h-3.5" />
          Schedule
        </button>
      </div>
    </div>
  );
}

/* ─── View tabs ──────────────────────────────────────────────── */
const VIEWS = ["All", "Needs Review", "Advancing", "Passed"] as const;
type View = (typeof VIEWS)[number];

/* ─── Main Page ──────────────────────────────────────────────── */
export default function PostCallReviewPage() {
  const trpc = useTRPC();
  const { data: rawCandidates, isLoading, isError } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );
  const { data: roles } = useQuery(trpc.recruiter.getRoles.queryOptions());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("All");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  const candidates = rawCandidates as Candidate[] | undefined;

  /* ── Stats ── */
  const stats = useMemo(() => {
    if (!candidates) return { total: 0, sent: 0, scheduled: 0, drafted: 0, pending: 0, advancing: 0 };
    const total = candidates.length;
    const statusCounts = { sent: 0, scheduled: 0, drafted: 0, pending: 0 };
    candidates.forEach((_, i) => statusCounts[getFollowUpStatus(i)]++);
    const advancing = candidates.filter((c) => c.stage === "interview" || c.stage === "offer" || c.stage === "day1").length;
    return { total, advancing, ...statusCounts };
  }, [candidates]);

  const completedCount = stats.sent + stats.scheduled + stats.drafted;
  const completionPct = stats.total === 0 ? 0 : Math.round((completedCount / stats.total) * 100);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    if (!candidates) return [];
    let list = [...candidates].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
    if (search)
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.school ?? "").toLowerCase().includes(search.toLowerCase())
      );
    if (filterRole !== "all")
      list = list.filter((c) => c.roleId === filterRole);
    if (view === "Needs Review")
      list = list.filter((_, i) => getFollowUpStatus(i) === "pending");
    else if (view === "Advancing")
      list = list.filter((c) => c.stage === "interview" || c.stage === "offer" || c.stage === "day1");
    else if (view === "Passed")
      list = list.filter((c) => c.stage === "fair" && (c.fitScore ?? 0) < 60);
    return list;
  }, [candidates, search, filterRole, view]);

  const selected = candidates?.find((c) => c.id === selectedId) ?? null;
  const selectedIdx = candidates ? candidates.findIndex((c) => c.id === selectedId) : -1;

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Failed to load reviews. Please refresh.</p>
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
          <h1 className="text-[28px] font-bold text-foreground leading-tight">Post-Call Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review candidates from today&apos;s fair · send follow-ups · finalize decisions
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Sync ATS
          </button>
          <button className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            className="h-9 px-4 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            <Send className="w-3.5 h-3.5" />
            Send All Drafts
            {stats.drafted > 0 && (
              <span className="ml-0.5 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {stats.drafted}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Stat pills ── */}
      <div className="flex gap-3">
        <StatPill icon={Users}        label="Candidates Reviewed" value={stats.total} />
        <StatPill icon={TrendingUp}   label="Advancing"           value={stats.advancing} sub={`of ${stats.total}`} accent />
        <StatPill icon={CheckCircle2} label="Follow-ups Sent"     value={stats.sent + stats.scheduled} />
        <StatPill icon={AlertCircle}  label="Needs Action"        value={stats.pending} />
      </div>

      {/* ── Progress card ── */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Follow-up Completion</p>
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              {completedCount} of {stats.total} done
            </span>
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: "#0e3d27" }}>
            {completionPct}%
          </span>
        </div>
        {/* Segmented bar */}
        <div className="h-2.5 w-full rounded-full overflow-hidden flex gap-px" style={{ background: "#e8f5ee" }}>
          {stats.sent > 0 && (
            <div className="h-full transition-all" style={{ width: `${(stats.sent / stats.total) * 100}%`, background: "#0e3d27" }} />
          )}
          {stats.scheduled > 0 && (
            <div className="h-full transition-all" style={{ width: `${(stats.scheduled / stats.total) * 100}%`, background: "#1f6b43" }} />
          )}
          {stats.drafted > 0 && (
            <div className="h-full transition-all" style={{ width: `${(stats.drafted / stats.total) * 100}%`, background: "#52b788" }} />
          )}
          {stats.pending > 0 && (
            <div className="h-full transition-all" style={{ width: `${(stats.pending / stats.total) * 100}%`, background: "#c5e4d1" }} />
          )}
        </div>
        <div className="flex items-center gap-5 mt-2.5">
          <LegendDot color="#0e3d27" label={`Sent: ${stats.sent}`} />
          <LegendDot color="#1f6b43" label={`Scheduled: ${stats.scheduled}`} />
          <LegendDot color="#52b788" label={`Drafted: ${stats.drafted}`} />
          <LegendDot color="#c5e4d1" label={`Pending: ${stats.pending}`} />
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-5 items-start">

        {/* ── Left: Candidate list ── */}
        <div className="flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden shadow-sm">

          {/* Filter bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/10">
            {/* View tabs */}
            <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 shrink-0">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    view === v ? "bg-[#1a3829] text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}
                  {v === "Needs Review" && stats.pending > 0 && (
                    <span className="ml-1.5 text-[9px] font-bold bg-white/20 px-1 py-0.5 rounded-full">
                      {stats.pending}
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
                  className="h-8 w-44 rounded-lg border border-border bg-card pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#1f6b43]"
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

          {/* Column header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/10">
            <div className="w-9 shrink-0" />
            <div className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Candidate</div>
            <div className="w-9 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Score</div>
            <div className="w-20 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Follow-up</div>
            <div className="w-3.5 shrink-0" />
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">No candidates match your filters</p>
            </div>
          ) : (
            <div>
              {filtered.map((c, listIdx) => {
                // Find original index for stable follow-up status
                const origIdx = candidates ? candidates.findIndex((x) => x.id === c.id) : listIdx;
                return (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    followUpStatus={getFollowUpStatus(origIdx)}
                    isSelected={selectedId === c.id}
                    onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                  />
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-muted/10 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
            </span>
            <button className="text-[11px] font-medium text-[#1f6b43] hover:underline flex items-center gap-1">
              Bulk Send <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Right: Review panel ── */}
        <div className="w-[300px] shrink-0 sticky top-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm" style={{ minHeight: 480 }}>
            {selected ? (
              <ReviewPanel
                candidate={selected}
                followUpStatus={getFollowUpStatus(selectedIdx)}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center h-full" style={{ minHeight: 480 }}>
                <div className="w-14 h-14 rounded-full bg-[#e8f5ee] flex items-center justify-center mb-4">
                  <Mail className="w-7 h-7 text-[#1f6b43]" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Select a Candidate</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Click any candidate to review their conversation notes, make a decision, and send a follow-up email.
                </p>
                <div className="mt-6 w-full space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    AI-generated email drafts
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-[#1f6b43] shrink-0" />
                    One-click advance to interview
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    Schedule or send immediately
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Legend Dot ─────────────────────────────────────────────── */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
