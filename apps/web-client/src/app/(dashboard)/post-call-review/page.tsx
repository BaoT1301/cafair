"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef, type ComponentType } from "react";
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
  TrendingUp,
  AlertCircle,
  ChevronRight,
  X,
  Check,
  Loader2,
  RotateCcw,
  Users,
} from "lucide-react";
import { getInitials } from "@/lib/recruiter-utils";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: Math.min(i, 10) * 0.045, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

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
type Decision = "advance" | "hold" | "pass";

/* ─── Helpers ────────────────────────────────────────────────── */
const FOLLOW_UP_STATUSES: FollowUpStatus[] = ["sent", "scheduled", "drafted", "pending"];
const getFollowUpStatus = (i: number): FollowUpStatus => FOLLOW_UP_STATUSES[i % FOLLOW_UP_STATUSES.length];
const getImpression = (score: number): Impression => {
  if (score >= 85) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 65) return "good";
  return "needs-review";
};

const IMPRESSION_CONFIG: Record<Impression, { label: string; bg: string; text: string; border: string }> = {
  excellent:      { label: "Excellent", bg: "#e8f5ee", text: "#0e3d27", border: "#c5e4d1" },
  strong:         { label: "Strong",    bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  good:           { label: "Good",      bg: "#fefce8", text: "#854d0e", border: "#fde68a" },
  "needs-review": { label: "Review",   bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
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
    subject: (_name, role) => `Interview Invitation — ${role}`,
    body: (name, role) =>
      `Hi ${name},\n\nThank you for meeting with us at Tech Talent Expo 2026. We were very impressed with your background and would love to continue the conversation.\n\nWe'd like to invite you to a formal interview for the ${role} position. Please let us know your availability this week or next.\n\nBest regards,\nThe Recruiting Team`,
  },
  thankyou: {
    label: "Thank You + Hold",
    subject: (_name, role) => `Thank You — ${role} Opportunity`,
    body: (name, role, strength) =>
      `Hi ${name},\n\nThank you for stopping by our booth at Tech Talent Expo 2026${strength ? ` and for sharing your experience in ${strength}` : ""}.\n\nWe are still evaluating candidates for the ${role} position and will be in touch soon with next steps.\n\nBest regards,\nThe Recruiting Team`,
  },
  rejection: {
    label: "Rejection",
    subject: (_name, role) => `Update on Your Application — ${role}`,
    body: (name, role) =>
      `Hi ${name},\n\nThank you for your interest in the ${role} position and for taking the time to meet with us at Tech Talent Expo 2026.\n\nAfter careful consideration, we have decided to move forward with other candidates at this time. We appreciate your time and encourage you to apply for future openings.\n\nBest of luck,\nThe Recruiting Team`,
  },
  hold: {
    label: "Custom",
    subject: (_name, role) => `Following Up — ${role} at Tech Talent Expo`,
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

/* ─── Toast ──────────────────────────────────────────────────── */
type ToastType = { msg: string; type?: "success" | "error" | "info" };

function Toast({ toast, onDismiss }: { toast: ToastType; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const bg = toast.type === "error" ? "#dc2626" : toast.type === "info" ? "#1f6b43" : "#0e3d27";
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 px-5 py-3 rounded-[14px] shadow-2xl text-white text-sm font-medium pointer-events-none"
      style={{ background: bg, minWidth: 260 }}
    >
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      {toast.msg}
    </div>
  );
}

/* ─── Schedule Modal ─────────────────────────────────────────── */
const SCHEDULE_DAYS = (() => {
  const days: { label: string; iso: string }[] = [];
  const base = new Date("2026-03-11");
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push({ label: `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`, iso: d.toISOString().slice(0, 10) });
  }
  return days;
})();

const SCHEDULE_TIMES = [
  "9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM",
  "12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM",
  "3:00 PM","3:30 PM",
];

function ScheduleModal({
  candidateName,
  onConfirm,
  onClose,
}: {
  candidateName: string;
  onConfirm: (day: string, time: string) => void;
  onClose: () => void;
}) {
  const [day, setDay] = useState(SCHEDULE_DAYS[0].iso);
  const [time, setTime] = useState(SCHEDULE_TIMES[2]);
  const dayLabel = SCHEDULE_DAYS.find((d) => d.iso === day)?.label ?? day;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[18px] shadow-2xl w-[400px] overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">Schedule Follow-up</p>
            <p className="text-xs text-gray-500 mt-0.5">{candidateName}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Day picker */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Select Day</p>
            <div className="grid grid-cols-4 gap-1.5">
              {SCHEDULE_DAYS.map((d) => (
                <button
                  key={d.iso}
                  onClick={() => setDay(d.iso)}
                  className="h-10 rounded-lg text-[10px] font-semibold transition-all border"
                  style={
                    day === d.iso
                      ? { background: "#0e3d27", color: "#fff", borderColor: "#0e3d27" }
                      : { background: "#f7f7f7", color: "#374151", borderColor: "#e5e7eb" }
                  }
                >
                  {d.label.split(" ").slice(0, 2).join("\n")}
                </button>
              ))}
            </div>
          </div>

          {/* Time picker */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Select Time</p>
            <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {SCHEDULE_TIMES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className="h-9 rounded-lg text-[10px] font-semibold transition-all border"
                  style={
                    time === t
                      ? { background: "#1f6b43", color: "#fff", borderColor: "#1f6b43" }
                      : { background: "#f7f7f7", color: "#374151", borderColor: "#e5e7eb" }
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(dayLabel, time)}
            className="flex-1 h-10 rounded-xl text-white text-xs font-semibold shadow-sm transition-opacity hover:opacity-90 active:scale-[0.97]"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            Confirm Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Bulk Send Confirm Modal ────────────────────────────────── */
function BulkConfirmModal({
  count,
  label,
  onConfirm,
  onClose,
}: {
  count: number;
  label: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[18px] shadow-2xl w-[340px] p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#e8f5ee] flex items-center justify-center mx-auto mb-4">
          <Send className="w-5 h-5 text-[#1f6b43]" />
        </div>
        <p className="text-base font-bold text-gray-900 mb-1">{label}</p>
        <p className="text-xs text-gray-500 mb-5">
          This will send follow-up emails to <strong>{count}</strong> candidate{count !== 1 ? "s" : ""} immediately.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 h-10 rounded-xl text-white text-xs font-semibold shadow-sm transition-opacity hover:opacity-90 active:scale-[0.97]"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            Send All
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Pill ──────────────────────────────────────────────── */
function StatPill({
  icon: Icon, label, value, sub, accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 border border-border rounded-xl px-4 py-3 flex-1 ${accent ? "bg-[#0e3d27]" : "bg-card"}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-white/10" : "bg-[#e8f5ee]"}`}>
        <Icon className={`w-4 h-4 ${accent ? "text-white" : "text-[#0e3d27]"}`} />
      </div>
      <div>
        <p className={`text-[10px] uppercase tracking-wide font-medium leading-none mb-1 ${accent ? "text-white/60" : "text-muted-foreground"}`}>{label}</p>
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
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
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

/* ─── Decision Pill ──────────────────────────────────────────── */
function DecisionPill({ decision }: { decision: Decision }) {
  if (decision === "advance") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#e8f5ee] text-[#0e3d27] border border-[#c5e4d1]">
      <Check className="w-2.5 h-2.5" /> Interview
    </span>
  );
  if (decision === "hold") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
      <Pause className="w-2.5 h-2.5" /> Hold
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
      <ThumbsDown className="w-2.5 h-2.5" /> Passed
    </span>
  );
}

/* ─── Candidate Row ──────────────────────────────────────────── */
function CandidateRow({
  candidate, followUpStatus, decision, isSelected, onClick,
}: {
  candidate: Candidate;
  followUpStatus: FollowUpStatus;
  decision?: Decision;
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
      <div className="shrink-0">
        {candidate.avatarUrl ? (
          <img src={candidate.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ background: impCfg.bg, color: impCfg.text }}>
            {getInitials(candidate.name)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{candidate.name}</span>
          <ImpressionBadge impression={impression} />
          {decision && <DecisionPill decision={decision} />}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {candidate.role ?? "—"} · {candidate.school ?? "University"}
        </p>
      </div>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold shadow-sm"
        style={score >= 85
          ? { background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)", color: "#fff" }
          : { background: "#f7f7f7", color: "#0e3d27" }}
      >
        {score}
      </div>
      <div className="w-20 shrink-0 flex justify-end">
        <FollowUpBadge status={followUpStatus} />
      </div>
      <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${isSelected ? "text-[#0e3d27]" : "text-muted-foreground/40"}`} />
    </div>
  );
}

/* ─── Review Panel ───────────────────────────────────────────── */
function ReviewPanel({
  candidate,
  followUpStatus,
  decision,
  advancing,
  onClose,
  onAdvance,
  onHold,
  onPass,
  onSend,
  onScheduleOpen,
}: {
  candidate: Candidate;
  followUpStatus: FollowUpStatus;
  decision?: Decision;
  advancing: boolean;
  onClose: () => void;
  onAdvance: () => void;
  onHold: () => void;
  onPass: () => void;
  onSend: () => void;
  onScheduleOpen: () => void;
}) {
  const [template, setTemplate] = useState<EmailTemplate>(() => {
    if (decision === "advance") return "interview";
    if (decision === "hold") return "thankyou";
    if (decision === "pass") return "rejection";
    return "interview";
  });

  // Sync template when decision changes (e.g. switching candidates)
  useEffect(() => {
    if (decision === "advance") setTemplate("interview");
    else if (decision === "hold") setTemplate("thankyou");
    else if (decision === "pass") setTemplate("rejection");
  }, [decision]);

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

  const handleAdvanceClick = () => {
    setTemplate("interview");
    onAdvance();
  };
  const handleHoldClick = () => {
    setTemplate("thankyou");
    onHold();
  };
  const handlePassClick = () => {
    setTemplate("rejection");
    onPass();
  };

  const emailSent = followUpStatus === "sent";
  const emailScheduled = followUpStatus === "scheduled";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {candidate.avatarUrl ? (
              <img src={candidate.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ background: impCfg.bg, color: impCfg.text }}>
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
              style={score >= 85
                ? { background: "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)", color: "#fff" }
                : { background: "#f7f7f7", color: "#0e3d27" }}
            >
              {score}%
            </div>
            <button onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors text-base leading-none">
              ×
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ImpressionBadge impression={impression} />
          <FollowUpBadge status={followUpStatus} />
          {decision && <DecisionPill decision={decision} />}
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
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-[#e8f5ee] text-[#0e3d27] font-medium border border-[#c5e4d1]">{s}</span>
              ))}
            </div>
          </div>
        )}
        {gaps.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Gaps</p>
            <div className="flex flex-wrap gap-1.5">
              {gaps.map((g, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-200">{g}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Decision */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-[11px] font-bold text-foreground uppercase tracking-wide mb-3">Decision</p>
        <div className="flex flex-col gap-2">
          {/* Advance */}
          <button
            disabled={advancing || decision === "advance"}
            onClick={handleAdvanceClick}
            className="w-full h-9 rounded-[14px] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-70"
            style={{
              background: decision === "advance"
                ? "linear-gradient(171deg, #052b1a 16.3%, #0e3d27 71.8%)"
                : "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)",
            }}
          >
            {advancing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Moving to Interview…</>
            ) : decision === "advance" ? (
              <><Check className="w-3.5 h-3.5" /> Advanced to Interview</>
            ) : (
              <><ThumbsUp className="w-3.5 h-3.5" /> Advance to Interview</>
            )}
          </button>
          <div className="flex gap-2">
            <button
              disabled={decision === "hold"}
              onClick={handleHoldClick}
              className={`flex-1 h-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                decision === "hold"
                  ? "bg-amber-50 text-amber-700 border-amber-300 opacity-80 cursor-default"
                  : "border-border bg-card text-muted-foreground hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
              }`}
            >
              <Pause className="w-3 h-3" />
              {decision === "hold" ? "On Hold" : "Hold"}
            </button>
            <button
              disabled={decision === "pass"}
              onClick={handlePassClick}
              className={`flex-1 h-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                decision === "pass"
                  ? "bg-red-50 text-red-600 border-red-200 opacity-80 cursor-default"
                  : "border-border bg-card text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              }`}
            >
              <ThumbsDown className="w-3 h-3" />
              {decision === "pass" ? "Passed" : "Pass"}
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
          {(emailSent || emailScheduled) && (
            <span className="text-[10px] font-semibold" style={{ color: "#1f6b43" }}>
              {emailSent ? "✓ Sent" : "✓ Scheduled"}
            </span>
          )}
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
          onClick={onSend}
          disabled={emailSent}
          className="flex-1 h-9 rounded-[14px] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:cursor-default"
          style={{ background: emailSent ? "#52b788" : "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
        >
          {emailSent ? <><Check className="w-3.5 h-3.5" /> Sent</> : <><Send className="w-3.5 h-3.5" /> Send Now</>}
        </button>
        <button
          onClick={onScheduleOpen}
          disabled={emailScheduled}
          className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1 hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-default"
        >
          <Calendar className="w-3.5 h-3.5" />
          {emailScheduled ? "Scheduled" : "Schedule"}
        </button>
      </div>
    </div>
  );
}

/* ─── View tabs ──────────────────────────────────────────────── */
const VIEWS = ["All", "Needs Review", "Advancing", "Passed"] as const;
type View = (typeof VIEWS)[number];

/* ─── Legend Dot ─────────────────────────────────────────────── */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function PostCallReviewPage() {
  const trpc = useTRPC();
  const { data: rawCandidates, isLoading, isError, refetch } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );
  const { data: roles } = useQuery(trpc.recruiter.getRoles.queryOptions());

  const updateStage = useMutation(
    trpc.recruiter.updateCandidateStage.mutationOptions()
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("All");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // Decision tracking: "advance" | "hold" | "pass"
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  // Follow-up status overrides
  const [followUpOverrides, setFollowUpOverrides] = useState<Map<string, FollowUpStatus>>(new Map());
  // Which candidate is currently having their interview advancing (loading)
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  // Modal / UI state
  const [scheduleFor, setScheduleFor] = useState<string | null>(null); // candidateId
  const [showBulkDrafts, setShowBulkDrafts] = useState(false);
  const [showBulkPending, setShowBulkPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<ToastType | null>(null);

  const showToast = (msg: string, type: ToastType["type"] = "success") => {
    setToast({ msg, type });
  };

  const candidates = rawCandidates as Candidate[] | undefined;

  /* ── Effective follow-up status ── */
  const getEffectiveFollowUp = (c: Candidate, origIdx: number): FollowUpStatus => {
    return followUpOverrides.get(c.id) ?? getFollowUpStatus(origIdx);
  };

  /* ── Stats ── */
  const stats = useMemo(() => {
    if (!candidates) return { total: 0, sent: 0, scheduled: 0, drafted: 0, pending: 0, advancing: 0 };
    const total = candidates.length;
    const statusCounts = { sent: 0, scheduled: 0, drafted: 0, pending: 0 };
    candidates.forEach((c, i) => {
      const status = followUpOverrides.get(c.id) ?? getFollowUpStatus(i);
      statusCounts[status]++;
    });
    const advancing = candidates.filter((c) =>
      decisions.get(c.id) === "advance" ||
      c.stage === "interview" || c.stage === "offer" || c.stage === "day1"
    ).length;
    return { total, advancing, ...statusCounts };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, decisions, followUpOverrides]);

  const completedCount = stats.sent + stats.scheduled + stats.drafted;
  const completionPct = stats.total === 0 ? 0 : Math.round((completedCount / stats.total) * 100);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    if (!candidates) return [];
    let list = [...candidates].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
    if (search)
      list = list.filter(
        (c) => c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.school ?? "").toLowerCase().includes(search.toLowerCase())
      );
    if (filterRole !== "all")
      list = list.filter((c) => c.roleId === filterRole);
    if (view === "Needs Review")
      list = list.filter((c) => !decisions.has(c.id));
    else if (view === "Advancing")
      list = list.filter((c) =>
        decisions.get(c.id) === "advance" ||
        c.stage === "interview" || c.stage === "offer" || c.stage === "day1"
      );
    else if (view === "Passed")
      list = list.filter((c) => decisions.get(c.id) === "pass");
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, search, filterRole, view, decisions]);

  const selected = candidates?.find((c) => c.id === selectedId) ?? null;
  const selectedIdx = candidates ? candidates.findIndex((c) => c.id === selectedId) : -1;

  /* ── Handlers ── */
  const handleAdvance = async (id: string) => {
    setAdvancingId(id);
    try {
      await updateStage.mutateAsync({ id, stage: "interview" });
      setDecisions((prev) => new Map(prev).set(id, "advance"));
      showToast("Moved to Interview ✓");
      refetch();
    } catch {
      showToast("Failed to advance candidate", "error");
    } finally {
      setAdvancingId(null);
    }
  };

  const handleHold = (id: string) => {
    setDecisions((prev) => new Map(prev).set(id, "hold"));
    showToast("Candidate placed on hold");
  };

  const handlePass = (id: string) => {
    setDecisions((prev) => new Map(prev).set(id, "pass"));
    showToast("Candidate marked as passed");
  };

  const handleSend = (id: string, name: string) => {
    setFollowUpOverrides((prev) => new Map(prev).set(id, "sent"));
    showToast(`Follow-up sent to ${name.split(" ")[0]}`);
  };

  const handleScheduleConfirm = (day: string, time: string) => {
    if (!scheduleFor) return;
    const c = candidates?.find((x) => x.id === scheduleFor);
    setFollowUpOverrides((prev) => new Map(prev).set(scheduleFor, "scheduled"));
    setScheduleFor(null);
    showToast(`Scheduled for ${day} at ${time}${c ? ` · ${c.name.split(" ")[0]}` : ""}`);
  };

  const handleSyncATS = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 1400));
    setSyncing(false);
    showToast("ATS synced successfully");
  };

  const handleExport = () => {
    if (!candidates) return;
    const rows = [
      ["Name", "Email", "School", "Role", "Score", "Stage", "Risk", "Decision", "Follow-up"],
      ...candidates.map((c, i) => [
        c.name,
        formatEmail(c),
        c.school ?? "",
        c.role ?? "",
        String(c.fitScore ?? 0),
        c.stage ?? "",
        c.riskLevel ?? "",
        decisions.get(c.id) ?? "",
        getEffectiveFollowUp(c, i),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "post-call-review.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported to CSV");
  };

  const handleSendAllDrafts = () => {
    if (!candidates) return;
    let count = 0;
    const updates = new Map(followUpOverrides);
    candidates.forEach((c, i) => {
      const status = followUpOverrides.get(c.id) ?? getFollowUpStatus(i);
      if (status === "drafted") {
        updates.set(c.id, "sent");
        count++;
      }
    });
    setFollowUpOverrides(updates);
    setShowBulkDrafts(false);
    showToast(`Sent ${count} drafted follow-up${count !== 1 ? "s" : ""}`);
  };

  const pendingFiltered = filtered.filter((c, li) => {
    const origIdx = candidates ? candidates.findIndex((x) => x.id === c.id) : li;
    return getEffectiveFollowUp(c, origIdx) === "pending";
  });

  const handleBulkSendPending = () => {
    if (!candidates) return;
    let count = 0;
    const updates = new Map(followUpOverrides);
    pendingFiltered.forEach((c) => {
      updates.set(c.id, "sent");
      count++;
    });
    setFollowUpOverrides(updates);
    setShowBulkPending(false);
    showToast(`Sent ${count} follow-up${count !== 1 ? "s" : ""}`);
  };

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
      {/* Toast */}
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      {/* Schedule Modal */}
      {scheduleFor && candidates && (
        <ScheduleModal
          candidateName={candidates.find((c) => c.id === scheduleFor)?.name ?? ""}
          onConfirm={handleScheduleConfirm}
          onClose={() => setScheduleFor(null)}
        />
      )}

      {/* Bulk Send Drafts Confirm */}
      {showBulkDrafts && (
        <BulkConfirmModal
          count={stats.drafted}
          label="Send All Drafted Follow-ups"
          onConfirm={handleSendAllDrafts}
          onClose={() => setShowBulkDrafts(false)}
        />
      )}

      {/* Bulk Send Pending Confirm */}
      {showBulkPending && (
        <BulkConfirmModal
          count={pendingFiltered.length}
          label="Send Follow-ups to Pending Candidates"
          onConfirm={handleBulkSendPending}
          onClose={() => setShowBulkPending(false)}
        />
      )}

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight">Post-Call Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review candidates from today&apos;s fair · send follow-ups · finalize decisions
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSyncATS}
            disabled={syncing}
            className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors disabled:opacity-60"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {syncing ? "Syncing…" : "Sync ATS"}
          </button>
          <button
            onClick={handleExport}
            className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={() => stats.drafted > 0 && setShowBulkDrafts(true)}
            disabled={stats.drafted === 0}
            className="h-9 px-4 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
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
      </motion.div>

      {/* ── Stat pills ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="flex gap-3">
        <StatPill icon={Users}        label="Candidates Reviewed" value={stats.total} />
        <StatPill icon={TrendingUp}   label="Advancing"           value={stats.advancing} sub={`of ${stats.total}`} accent />
        <StatPill icon={CheckCircle2} label="Follow-ups Sent"     value={stats.sent + stats.scheduled} />
        <StatPill icon={AlertCircle}  label="Needs Action"        value={stats.pending} />
      </motion.div>

      {/* ── Progress card ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.14, ease: [0.22, 1, 0.36, 1] }} className="bg-card border border-border rounded-xl p-4 shadow-sm">
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
        <div className="h-2.5 w-full rounded-full overflow-hidden flex gap-px" style={{ background: "#e8f5ee" }}>
          {stats.sent > 0 && <div className="h-full transition-all" style={{ width: `${(stats.sent / stats.total) * 100}%`, background: "#0e3d27" }} />}
          {stats.scheduled > 0 && <div className="h-full transition-all" style={{ width: `${(stats.scheduled / stats.total) * 100}%`, background: "#1f6b43" }} />}
          {stats.drafted > 0 && <div className="h-full transition-all" style={{ width: `${(stats.drafted / stats.total) * 100}%`, background: "#52b788" }} />}
          {stats.pending > 0 && <div className="h-full transition-all" style={{ width: `${(stats.pending / stats.total) * 100}%`, background: "#c5e4d1" }} />}
        </div>
        <div className="flex items-center gap-5 mt-2.5">
          <LegendDot color="#0e3d27" label={`Sent: ${stats.sent}`} />
          <LegendDot color="#1f6b43" label={`Scheduled: ${stats.scheduled}`} />
          <LegendDot color="#52b788" label={`Drafted: ${stats.drafted}`} />
          <LegendDot color="#c5e4d1" label={`Pending: ${stats.pending}`} />
        </div>
      </motion.div>

      {/* ── Main layout ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} className="flex gap-5" style={{ height: "calc(100vh - 330px)", minHeight: 400 }}>

        {/* ── Left: Candidate list ── */}
        <div className="flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">

          {/* Filter bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/10">
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
                  {v === "Advancing" && stats.advancing > 0 && (
                    <span className="ml-1.5 text-[9px] font-bold bg-white/20 px-1 py-0.5 rounded-full">
                      {stats.advancing}
                    </span>
                  )}
                </button>
              ))}
            </div>
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
            <div className="py-16 text-center flex-1">
              <p className="text-sm text-muted-foreground">No candidates match your filters</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filtered.map((c, listIdx) => {
                const origIdx = candidates ? candidates.findIndex((x) => x.id === c.id) : listIdx;
                return (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    followUpStatus={getEffectiveFollowUp(c, origIdx)}
                    decision={decisions.get(c.id)}
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
              {view !== "All" && ` · ${view}`}
            </span>
            <button
              onClick={() => pendingFiltered.length > 0 && setShowBulkPending(true)}
              disabled={pendingFiltered.length === 0}
              className="text-[11px] font-medium text-[#1f6b43] hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
            >
              Bulk Send {pendingFiltered.length > 0 && `(${pendingFiltered.length})`} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Right: Review panel ── */}
        <div className="w-[300px] shrink-0 flex flex-col">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col flex-1">
            {selected ? (
              <ReviewPanel
                candidate={selected}
                followUpStatus={getEffectiveFollowUp(selected, selectedIdx)}
                decision={decisions.get(selected.id)}
                advancing={advancingId === selected.id}
                onClose={() => setSelectedId(null)}
                onAdvance={() => handleAdvance(selected.id)}
                onHold={() => handleHold(selected.id)}
                onPass={() => handlePass(selected.id)}
                onSend={() => handleSend(selected.id, selected.name)}
                onScheduleOpen={() => setScheduleFor(selected.id)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center flex-1">
                <div className="w-14 h-14 rounded-full bg-[#e8f5ee] flex items-center justify-center mb-4">
                  <Mail className="w-7 h-7 text-[#1f6b43]" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Select a Candidate</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Click any candidate to review their notes, make a decision, and send a follow-up email.
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

                {/* Quick summary of decisions */}
                {decisions.size > 0 && (
                  <div className="mt-5 pt-4 border-t border-border w-full space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Session Decisions</p>
                    {Array.from(decisions.entries()).slice(0, 4).map(([id, dec]) => {
                      const c = candidates?.find((x) => x.id === id);
                      if (!c) return null;
                      return (
                        <div key={id} className="flex items-center justify-between">
                          <span className="text-[11px] text-foreground truncate">{c.name.split(" ")[0]}</span>
                          <DecisionPill decision={dec} />
                        </div>
                      );
                    })}
                    {decisions.size > 4 && (
                      <p className="text-[10px] text-muted-foreground">+{decisions.size - 4} more</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
