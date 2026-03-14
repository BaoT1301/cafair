"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ChevronDown, X, AlertTriangle, CheckCircle2,
  User, Send, ExternalLink, MessageSquare, Clock,
} from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: Math.min(i, 10) * 0.045, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/* ─── Types ──────────────────────────────────────────────────── */

type Severity = "HIGH" | "MED" | "LOW";

type RiskFlag = {
  id: string;
  severity: Severity;
  title: string;
  candidate: string;
  role: string;
  detectedDate: string;
  evidence: string;
  claim: string;
  conflictingSignal: string;
  recommendedAction: string;
  suggestedQuestion: string;
  req: string;
  flagType: string;
};

type EscalationInfo = {
  manager: string;
  managerId: string;
  note: string;
  urgency: "urgent" | "normal";
  time: string;
};

/* ─── Mock Data ──────────────────────────────────────────────── */

const MOCK_FLAGS: RiskFlag[] = [
  {
    id: "1",
    severity: "HIGH",
    title: "Skill Claim Mismatch",
    candidate: "Priya Nair",
    role: "Software Engineer",
    detectedDate: "Feb 19",
    req: "SWE-001",
    flagType: "Skill",
    evidence:
      "Claimed 5 years Python experience; micro-screen responses suggest beginner-level familiarity",
    claim:
      '"Led Python infrastructure at scale for 5 years, including async processing and distributed systems."',
    conflictingSignal:
      'Micro-screen Q2 ("Describe a Python async pattern you\'ve used") received a response describing basic threading, not async/io or coroutine-based patterns expected at 5+ year level.',
    recommendedAction:
      'Ask directly in technical interview. Consider: "Walk me through the most complex async Python system you\'ve built"',
    suggestedQuestion:
      "Walk me through the most complex async Python system you've built end-to-end.",
  },
  {
    id: "2",
    severity: "MED",
    title: "Employment Date Gap",
    candidate: "Marcus Chen",
    role: "Software Engineer",
    detectedDate: "Feb 17",
    req: "SWE-001",
    flagType: "Employment",
    evidence:
      "Resume shows 8-month gap between Airbnb (Jun 2018) and Stripe (Feb 2019). No explanation provided.",
    claim:
      '"Continuous employment history in software engineering roles from 2015 to present."',
    conflictingSignal:
      "Resume dates show an 8-month gap between Airbnb (Jun 2018) and Stripe (Feb 2019) that was not mentioned in the application or micro-screen.",
    recommendedAction:
      'Ask candidate to clarify: "Can you walk me through what you were doing between June 2018 and February 2019?"',
    suggestedQuestion:
      "Can you walk me through what you were doing between June 2018 and February 2019?",
  },
  {
    id: "3",
    severity: "LOW",
    title: "Date Inconsistency",
    candidate: "Alex Torres",
    role: "Software Engineer",
    detectedDate: "Feb 15",
    req: "SWE-002",
    flagType: "Dates",
    evidence:
      "LinkedIn end date for role (Jan 2022) differs from resume (Mar 2022) — minor discrepancy",
    claim: '"Left previous role in March 2022 to pursue new opportunities."',
    conflictingSignal:
      "LinkedIn profile shows end date of January 2022 for the same position listed as March 2022 on the resume.",
    recommendedAction:
      "Minor discrepancy — note for reference. Can clarify briefly during interview if needed.",
    suggestedQuestion:
      "Your LinkedIn shows January 2022 as your end date but your resume shows March — can you clarify?",
  },
];

const MOCK_MANAGERS = [
  { id: "m1", name: "Jennifer Walsh", title: "Head of Engineering Recruiting", initials: "JW" },
  { id: "m2", name: "David Kim", title: "VP of Talent Acquisition", initials: "DK" },
  { id: "m3", name: "Sarah Torres", title: "Recruiting Manager", initials: "ST" },
];

/* ─── Severity config ────────────────────────────────────────── */

const SEVERITY_CONFIG = {
  HIGH: { bg: "#fee2e2", text: "#991b1b", border: "#fecaca", label: "HIGH", leftBorder: "#991b1b" },
  MED:  { bg: "#fef3c7", text: "#92400e", border: "#fde68a", label: "MED",  leftBorder: "#d97706" },
  LOW:  { bg: "#f0f0f0", text: "#4b5563", border: "#e2e8e5", label: "LOW",  leftBorder: "#e2e8e5" },
};

/* ─── Toast ──────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-[14px] shadow-xl"
      style={{
        transform: "translateX(-50%)",
        background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)",
        color: "#fff",
        minWidth: 240,
      }}
    >
      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#abdd64" }} />
      <span className="text-[13px] font-medium">{message}</span>
      <button onClick={onDone} className="ml-auto opacity-60 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Escalate Modal ─────────────────────────────────────────── */

function EscalateModal({
  flag,
  onClose,
  onSend,
}: {
  flag: RiskFlag;
  onClose: () => void;
  onSend: (flagId: string, manager: string, managerId: string, note: string, urgency: "urgent" | "normal") => void;
}) {
  const [selectedManager, setSelectedManager] = useState(MOCK_MANAGERS[0].id);
  const [urgency, setUrgency] = useState<"urgent" | "normal">("urgent");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const manager = MOCK_MANAGERS.find(m => m.id === selectedManager)!;
  const severityCfg = SEVERITY_CONFIG[flag.severity];

  function handleSend() {
    setSent(true);
    setTimeout(() => {
      onSend(flag.id, manager.name, manager.id, note, urgency);
    }, 1400);
  }

  if (sent) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-8 flex flex-col items-center gap-5 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#e8f5ee" }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: "#1f6b43" }} />
            </div>
            <div>
              <p className="text-[20px] font-bold" style={{ color: "#111827" }}>
                Escalation Sent
              </p>
              <p className="text-[13px] mt-1" style={{ color: "#6b7280" }}>
                {manager.name} has been notified and will review this flag.
              </p>
            </div>
            <div
              className="w-full rounded-[12px] p-3 border text-left"
              style={{ background: "#f7f7f7", borderColor: "#e2e8e5" }}
            >
              <p className="text-[12px] font-semibold" style={{ color: "#4b5563" }}>
                Escalated flag
              </p>
              <p className="text-[13px] font-semibold mt-0.5" style={{ color: "#111827" }}>
                {flag.candidate} — {flag.title}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "#6b7280" }}>
                {urgency === "urgent" ? "🔴 Urgent" : "🟡 Normal"} · Sent to {manager.name}
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-[520px] flex flex-col" style={{ maxHeight: "90vh" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#f0f0f0" }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#fee2e2" }}>
                <AlertTriangle className="w-4 h-4" style={{ color: "#991b1b" }} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold" style={{ color: "#111827" }}>Escalate to Manager</h2>
                <p className="text-[11px]" style={{ color: "#6b7280" }}>Notify a manager to review this flag</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
              style={{ borderColor: "#e2e8e5", color: "#4b5563" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            {/* Flag summary */}
            <div
              className="rounded-[12px] p-3 border-l-4"
              style={{
                background: severityCfg.bg,
                borderLeftColor: severityCfg.leftBorder,
                borderTop: `1px solid ${severityCfg.border}`,
                borderRight: `1px solid ${severityCfg.border}`,
                borderBottom: `1px solid ${severityCfg.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-[6px]"
                  style={{ background: severityCfg.text, color: "#fff" }}
                >
                  {flag.severity}
                </span>
                <span className="text-[12px] font-semibold" style={{ color: severityCfg.text }}>
                  {flag.flagType}
                </span>
              </div>
              <p className="text-[13px] font-semibold" style={{ color: "#111827" }}>
                {flag.candidate} — {flag.title}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "#6b7280" }}>
                {flag.role} · Detected {flag.detectedDate}
              </p>
            </div>

            {/* Manager selection */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
                Select Manager
              </p>
              <div className="flex flex-col gap-2">
                {MOCK_MANAGERS.map(mgr => {
                  const isSelected = selectedManager === mgr.id;
                  return (
                    <button
                      key={mgr.id}
                      onClick={() => setSelectedManager(mgr.id)}
                      className="flex items-center gap-3 p-3 rounded-[12px] border text-left transition-all"
                      style={{
                        borderColor: isSelected ? "#1f6b43" : "#e2e8e5",
                        background: isSelected ? "#e8f5ee" : "#fff",
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
                        style={{
                          background: isSelected ? "#1f6b43" : "#f7f7f7",
                          color: isSelected ? "#fff" : "#4b5563",
                        }}
                      >
                        {mgr.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: "#111827" }}>{mgr.name}</p>
                        <p className="text-[11px]" style={{ color: "#6b7280" }}>{mgr.title}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#1f6b43" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Urgency */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
                Urgency
              </p>
              <div className="flex gap-2">
                {(["urgent", "normal"] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setUrgency(u)}
                    className="flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold border transition-all"
                    style={{
                      borderColor: urgency === u ? (u === "urgent" ? "#991b1b" : "#1f6b43") : "#e2e8e5",
                      background: urgency === u ? (u === "urgent" ? "#fee2e2" : "#e8f5ee") : "#fff",
                      color: urgency === u ? (u === "urgent" ? "#991b1b" : "#1f6b43") : "#6b7280",
                    }}
                  >
                    {u === "urgent" ? "🔴 Urgent" : "🟡 Normal"}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
                Escalation Note (optional)
              </p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder={`Add context for ${manager.name}…`}
                className="w-full px-3 py-2.5 rounded-[12px] border text-[13px] resize-none focus:outline-none transition-colors"
                style={{
                  borderColor: "#e2e8e5",
                  color: "#111827",
                }}
                onFocus={e => (e.target.style.borderColor = "#1f6b43")}
                onBlur={e => (e.target.style.borderColor = "#e2e8e5")}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "#f0f0f0" }}>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] border text-[13px] font-medium transition-colors hover:bg-gray-50"
              style={{ borderColor: "#e2e8e5", color: "#4b5563" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              className="flex items-center gap-2 px-5 py-2 rounded-[10px] text-[13px] font-semibold text-white transition-colors"
              style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}
            >
              <Send className="w-3.5 h-3.5" />
              Send Escalation
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Flag Detail Modal ──────────────────────────────────────── */

function FlagDetailModal({
  flag,
  escalationInfo,
  onClose,
  onEscalate,
  onMarkReviewed,
}: {
  flag: RiskFlag;
  escalationInfo?: EscalationInfo;
  onClose: () => void;
  onEscalate: (flag: RiskFlag) => void;
  onMarkReviewed: (id: string) => void;
}) {
  const router = useRouter();
  const [interviewNote, setInterviewNote] = useState("");
  const severityCfg = SEVERITY_CONFIG[flag.severity];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
          {/* Header */}
          <div
            className="flex items-start justify-between px-6 py-4 border-b shrink-0"
            style={{ borderColor: "#f0f0f0" }}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-[8px]"
                  style={{ background: severityCfg.bg, color: severityCfg.text, border: `1px solid ${severityCfg.border}` }}
                >
                  {flag.severity} RISK
                </span>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-[6px]"
                  style={{ background: "#f7f7f7", color: "#4b5563" }}
                >
                  {flag.flagType}
                </span>
                {escalationInfo && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-[6px]"
                    style={{ background: "#fef3c7", color: "#92400e" }}
                  >
                    ↑ Escalated to {escalationInfo.manager}
                  </span>
                )}
              </div>
              <h2 className="text-[20px] font-bold" style={{ color: "#111827" }}>
                {flag.title}
              </h2>
              <p className="text-[13px]" style={{ color: "#6b7280" }}>
                {flag.candidate} · {flag.role} · Detected {flag.detectedDate} · {flag.req}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50 shrink-0 ml-4"
              style={{ borderColor: "#e2e8e5", color: "#4b5563" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

            {/* Evidence */}
            <div
              className="rounded-[12px] p-4 border-l-4"
              style={{ background: "#f7f7f7", borderLeftColor: severityCfg.leftBorder }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9ca3af" }}>
                Evidence Summary
              </p>
              <p className="text-[14px]" style={{ color: "#111827" }}>{flag.evidence}</p>
            </div>

            {/* Claim vs Signal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
                  What They Claimed
                </p>
                <div className="rounded-[12px] p-3 border" style={{ borderColor: "#e2e8e5", background: "#fff" }}>
                  <p className="text-[13px] italic" style={{ color: "#374151" }}>{flag.claim}</p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
                  Conflicting Signal
                </p>
                <div className="rounded-[12px] p-3 border" style={{ borderColor: "#fecaca", background: "#fff5f5" }}>
                  <p className="text-[13px]" style={{ color: "#374151" }}>{flag.conflictingSignal}</p>
                </div>
              </div>
            </div>

            {/* Recommended action */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
                Recommended Action
              </p>
              <div className="rounded-[12px] p-4 border" style={{ borderColor: "#c5e4d1", background: "#e8f5ee" }}>
                <p className="text-[13px]" style={{ color: "#0e3d27" }}>{flag.recommendedAction}</p>
              </div>
            </div>

            {/* Suggested interview question */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
                Suggested Interview Question
              </p>
              <div
                className="rounded-[12px] p-4 border flex items-start gap-3"
                style={{ borderColor: "#e2e8e5", background: "#fff" }}
              >
                <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#1f6b43" }} />
                <p className="text-[14px] font-medium" style={{ color: "#111827" }}>
                  &ldquo;{flag.suggestedQuestion}&rdquo;
                </p>
              </div>
            </div>

            {/* Escalation info (if already escalated) */}
            {escalationInfo && (
              <div
                className="rounded-[12px] p-4 border"
                style={{ borderColor: "#fde68a", background: "#fef3c7" }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#92400e" }}>
                  Escalation Status
                </p>
                <p className="text-[13px] font-semibold" style={{ color: "#92400e" }}>
                  Escalated to {escalationInfo.manager} at {escalationInfo.time}
                </p>
                {escalationInfo.note && (
                  <p className="text-[12px] mt-1" style={{ color: "#78350f" }}>
                    Note: {escalationInfo.note}
                  </p>
                )}
              </div>
            )}

            {/* Your interview notes */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
                Your Interview Notes
              </p>
              <textarea
                value={interviewNote}
                onChange={e => setInterviewNote(e.target.value)}
                rows={3}
                placeholder="Add notes about how you plan to probe this in the interview…"
                className="w-full px-3 py-2.5 rounded-[12px] border text-[13px] resize-none focus:outline-none transition-colors"
                style={{ borderColor: "#e2e8e5", color: "#111827" }}
                onFocus={e => (e.target.style.borderColor = "#1f6b43")}
                onBlur={e => (e.target.style.borderColor = "#e2e8e5")}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-6 py-4 border-t shrink-0"
            style={{ borderColor: "#f0f0f0" }}
          >
            <button
              onClick={() => { router.push("/recruiter/candidates"); onClose(); }}
              className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
              style={{ color: "#1f6b43" }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Candidate Profile
            </button>

            <div className="flex items-center gap-3">
              {!escalationInfo && (
                <button
                  onClick={() => { onClose(); onEscalate(flag); }}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] border text-[13px] font-semibold transition-colors"
                  style={{ borderColor: "#991b1b", color: "#991b1b", background: "#fff" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Escalate
                </button>
              )}
              <button
                onClick={() => { onMarkReviewed(flag.id); onClose(); }}
                className="h-9 px-4 rounded-[10px] text-[13px] font-semibold text-white transition-colors"
                style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}
              >
                Mark Reviewed
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Severity Badge ─────────────────────────────────────────── */

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span
      className="inline-flex items-center justify-center h-[22px] px-[9px] rounded-[8px] text-[12px] font-semibold leading-4 whitespace-nowrap border"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

/* ─── Filter Dropdown ────────────────────────────────────────── */

function FilterBtn({
  label, value, options, onChange,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative h-full">
      <div className="flex items-center justify-between gap-1 bg-white rounded-[14px] h-full px-3 py-[6px] pointer-events-none">
        <span className="text-[14px] font-medium text-[#111827] leading-5 whitespace-nowrap">
          {value === "all" ? label : value}
        </span>
        <ChevronDown className="w-4 h-4 text-[#111827] shrink-0" />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer"
      >
        <option value="all">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ─── Flag Card ──────────────────────────────────────────────── */

function FlagCard({
  flag,
  isSelected,
  isReviewing,
  escalationInfo,
  onSelect,
  onViewDetail,
  onMarkReviewed,
  onEscalate,
}: {
  flag: RiskFlag;
  isSelected: boolean;
  isReviewing: boolean;
  escalationInfo?: EscalationInfo;
  onSelect: () => void;
  onViewDetail: (flag: RiskFlag) => void;
  onMarkReviewed: (id: string) => void;
  onEscalate: (flag: RiskFlag) => void;
}) {
  const severityCfg = SEVERITY_CONFIG[flag.severity];
  const isEscalated = !!escalationInfo;

  return (
    <div
      className="bg-white rounded-[14px] px-6 py-5 flex flex-col gap-3 border-l-4 cursor-pointer transition-all"
      style={{
        borderLeftColor: severityCfg.leftBorder,
        borderTop: `1px solid ${isSelected ? "#1f6b43" : "#e2e8e5"}`,
        borderRight: `1px solid ${isSelected ? "#1f6b43" : "#e2e8e5"}`,
        borderBottom: `1px solid ${isSelected ? "#1f6b43" : "#e2e8e5"}`,
        boxShadow: isSelected ? "0 0 0 1px #1f6b43" : "0px 1px 4px rgba(0,0,0,0.04)",
        opacity: isReviewing ? 0.4 : 1,
        transform: isReviewing ? "scale(0.98)" : "scale(1)",
        transition: "all 0.3s ease",
      }}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={flag.severity} />
            <h3 className="text-[16px] font-semibold whitespace-nowrap" style={{ color: "#111827" }}>
              {flag.title}
            </h3>
            {isEscalated && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                ↑ {escalationInfo!.manager}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 shrink-0" style={{ color: "#9ca3af" }} />
            <p className="text-[13px]" style={{ color: "#4b5563" }}>
              {flag.candidate} · {flag.role} · {flag.req}
            </p>
            <span style={{ color: "#d1d5db" }}>·</span>
            <Clock className="w-3 h-3 shrink-0" style={{ color: "#9ca3af" }} />
            <p className="text-[12px]" style={{ color: "#9ca3af" }}>{flag.detectedDate}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onViewDetail(flag)}
            className="h-8 px-3 rounded-[8px] border text-[12px] font-medium transition-colors"
            style={{ borderColor: "#0e3d27", color: "#0e3d27", background: "#fff" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e8f5ee")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >
            View Detail →
          </button>
          <button
            onClick={() => onMarkReviewed(flag.id)}
            className="h-8 px-3 rounded-[8px] border text-[12px] font-medium transition-colors"
            style={{ borderColor: "#0e3d27", color: "#0e3d27", background: "#fff" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e8f5ee")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >
            Mark Reviewed
          </button>
          {flag.severity === "HIGH" && (
            isEscalated ? (
              <span
                className="h-8 px-3 rounded-[8px] text-[12px] font-semibold flex items-center gap-1"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                <CheckCircle2 className="w-3 h-3" />
                Escalated
              </span>
            ) : (
              <button
                onClick={() => onEscalate(flag)}
                className="h-8 px-3 rounded-[8px] border text-[12px] font-semibold transition-colors"
                style={{ borderColor: "#991b1b", color: "#991b1b", background: "#fff" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
              >
                Escalate
              </button>
            )
          )}
        </div>
      </div>

      {/* Evidence */}
      <div
        className="rounded-[10px] p-3 border"
        style={{ background: "#f7f7f7", borderColor: "#e2e8e5" }}
      >
        <p className="text-[13px]" style={{ color: "#374151" }}>{flag.evidence}</p>
      </div>
    </div>
  );
}

/* ─── Right Detail Panel ─────────────────────────────────────── */

function FlagDetailPanel({
  flag,
  escalationInfo,
  onMarkReviewed,
  onEscalate,
  onViewDetail,
}: {
  flag: RiskFlag | null;
  escalationInfo?: EscalationInfo;
  onMarkReviewed: (id: string) => void;
  onEscalate: (flag: RiskFlag) => void;
  onViewDetail: (flag: RiskFlag) => void;
}) {
  if (!flag) {
    return (
      <div
        className="rounded-[16px] p-6 flex flex-col items-center justify-center h-full"
        style={{ background: "#f7f7f7" }}
      >
        <AlertTriangle className="w-8 h-8 mb-3" style={{ color: "#d1d5db" }} />
        <p className="text-[14px]" style={{ color: "#9ca3af" }}>Select a flag to view details</p>
      </div>
    );
  }

  const severityCfg = SEVERITY_CONFIG[flag.severity];
  const isEscalated = !!escalationInfo;

  return (
    <div
      className="rounded-[16px] p-5 flex flex-col gap-4 h-full overflow-y-auto"
      style={{ background: "#f7f7f7" }}
    >
      <p className="text-[11px] font-bold text-[#111827] leading-5 tracking-[0.4px] uppercase">
        Flag Detail
      </p>

      {/* Severity + title */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={flag.severity} />
          {isEscalated && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>
              Escalated
            </span>
          )}
        </div>
        <h2 className="text-[16px] font-bold" style={{ color: "#111827" }}>
          {flag.candidate} — {flag.title}
        </h2>
        <p className="text-[12px]" style={{ color: "#6b7280" }}>
          {flag.role} · Detected {flag.detectedDate}
        </p>
      </div>

      {/* Claim */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#9ca3af" }}>Claim</p>
        <p className="text-[13px] italic" style={{ color: "#111827" }}>{flag.claim}</p>
      </div>

      {/* Conflicting signal */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#9ca3af" }}>Conflicting Signal</p>
        <div className="rounded-[10px] p-3 border" style={{ borderColor: "#fecaca", background: "#fff5f5" }}>
          <p className="text-[12px]" style={{ color: "#374151" }}>{flag.conflictingSignal}</p>
        </div>
      </div>

      {/* Recommended action */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#9ca3af" }}>Recommended Action</p>
        <div className="rounded-[10px] p-3" style={{ background: "#fff" }}>
          <p className="text-[12px]" style={{ color: "#111827" }}>{flag.recommendedAction}</p>
        </div>
      </div>

      {/* Escalation info */}
      {isEscalated && (
        <div className="rounded-[10px] p-3 border" style={{ borderColor: "#fde68a", background: "#fef3c7" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#92400e" }}>
            Escalation
          </p>
          <p className="text-[12px] font-semibold" style={{ color: "#92400e" }}>
            → {escalationInfo!.manager}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#78350f" }}>
            {escalationInfo!.urgency === "urgent" ? "🔴 Urgent" : "🟡 Normal"} · {escalationInfo!.time}
          </p>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "#e2e8e5" }}>
        <button
          onClick={() => onViewDetail(flag)}
          className="w-full h-9 rounded-[10px] border text-[13px] font-medium transition-colors"
          style={{ borderColor: "#0e3d27", color: "#0e3d27", background: "#fff" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#e8f5ee")}
          onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          View Full Detail →
        </button>
        {!isEscalated && flag.severity === "HIGH" && (
          <button
            onClick={() => onEscalate(flag)}
            className="w-full h-9 rounded-[10px] border text-[13px] font-semibold transition-colors"
            style={{ borderColor: "#991b1b", color: "#991b1b", background: "#fff" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
            Escalate to Manager
          </button>
        )}
        <button
          onClick={() => onMarkReviewed(flag.id)}
          className="w-full h-9 rounded-[10px] text-[13px] font-semibold text-white transition-colors"
          style={{ background: "linear-gradient(164deg, #0e3d27 16.3%, #1f6b43 71.81%)" }}
        >
          Mark Reviewed
        </button>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function RiskFlagsPage() {
  const [search,          setSearch]          = useState("");
  const [severityFilter,  setSeverityFilter]  = useState("all");
  const [reqFilter,       setReqFilter]       = useState("all");
  const [flagTypeFilter,  setFlagTypeFilter]  = useState("all");
  const [roleSort,        setRoleSort]        = useState("All");
  const [selectedId,      setSelectedId]      = useState<string>("1");
  const [flags,           setFlags]           = useState<RiskFlag[]>(MOCK_FLAGS);
  const [reviewingId,     setReviewingId]     = useState<string | null>(null);
  const [viewingFlag,     setViewingFlag]     = useState<RiskFlag | null>(null);
  const [escalatingFlag,  setEscalatingFlag]  = useState<RiskFlag | null>(null);
  const [escalated,       setEscalated]       = useState<Map<string, EscalationInfo>>(new Map());
  const [toast,           setToast]           = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleMarkReviewed(id: string) {
    setReviewingId(id);
    showToast("Flag marked as reviewed and removed");
    setTimeout(() => {
      setFlags(prev => {
        const next = prev.filter(f => f.id !== id);
        if (selectedId === id) setSelectedId(next[0]?.id ?? "");
        return next;
      });
      setReviewingId(null);
    }, 350);
    if (viewingFlag?.id === id) setViewingFlag(null);
  }

  function handleEscalateSend(
    flagId: string,
    manager: string,
    managerId: string,
    note: string,
    urgency: "urgent" | "normal",
  ) {
    const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setEscalated(prev => new Map(prev).set(flagId, { manager, managerId, note, urgency, time }));
    setEscalatingFlag(null);
    showToast(`Escalated to ${manager}`);
  }

  const filtered = useMemo(() => {
    return flags.filter(f => {
      if (search && !f.candidate.toLowerCase().includes(search.toLowerCase()) &&
          !f.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (reqFilter !== "all" && f.req !== reqFilter) return false;
      if (flagTypeFilter !== "all" && f.flagType !== flagTypeFilter) return false;
      if (roleSort !== "All" && f.role !== roleSort) return false;
      return true;
    });
  }, [flags, search, severityFilter, reqFilter, flagTypeFilter, roleSort]);

  const selectedFlag = filtered.find(f => f.id === selectedId) ?? filtered[0] ?? null;
  const uniqueReqs      = [...new Set(flags.map(f => f.req))];
  const uniqueFlagTypes = [...new Set(flags.map(f => f.flagType))];
  const uniqueRoles     = [...new Set(flags.map(f => f.role))];
  const highCount = filtered.filter(f => f.severity === "HIGH").length;
  const escalatedCount = escalated.size;

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-[16px] px-5 py-4 flex items-center justify-between shrink-0"
        style={{ background: "#f7f7f7", boxShadow: "0px 1px 4px rgba(0,0,0,0.05)" }}
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold leading-9" style={{ color: "#111827" }}>
            Verification Risk Flags
          </h1>
          <div className="flex items-center gap-3 text-[13px]" style={{ color: "#6b7280" }}>
            <span>{filtered.length} active flag{filtered.length !== 1 ? "s" : ""}</span>
            <span style={{ color: "#d1d5db" }}>·</span>
            {highCount > 0 && (
              <>
                <span style={{ color: "#991b1b", fontWeight: 600 }}>{highCount} high risk</span>
                <span style={{ color: "#d1d5db" }}>·</span>
              </>
            )}
            {escalatedCount > 0 && (
              <>
                <span style={{ color: "#92400e", fontWeight: 600 }}>{escalatedCount} escalated</span>
                <span style={{ color: "#d1d5db" }}>·</span>
              </>
            )}
            <span>sorted by severity</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative h-[42px] w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#4b5563" }} />
          <input
            type="text"
            placeholder="Search candidate or flag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-full bg-white rounded-[14px] pl-10 pr-4 text-[14px] outline-none"
            style={{ color: "#111827" }}
          />
        </div>
      </motion.div>

      {/* ── Body ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="flex gap-4 flex-1 min-h-0">

        {/* Left: filters + flag list */}
        <div
          className="rounded-[16px] flex-1 min-w-0 flex flex-col gap-5 px-4 py-5 overflow-y-auto"
          style={{ background: "#f7f7f7" }}
        >
          {/* Filters */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 h-9">
              <FilterBtn label="Severity"  value={severityFilter}  options={["HIGH", "MED", "LOW"]} onChange={setSeverityFilter} />
              <FilterBtn label="Req"       value={reqFilter}        options={uniqueReqs}              onChange={setReqFilter} />
              <FilterBtn label="Flag Type" value={flagTypeFilter}   options={uniqueFlagTypes}         onChange={setFlagTypeFilter} />
            </div>
            <div className="flex items-center h-[34px]">
              <span className="text-[13px] px-2" style={{ color: "#6b7280" }}>Sort by role</span>
              <div className="relative w-[180px] h-full">
                <div className="flex items-center justify-between bg-white rounded-[14px] h-full px-4 py-2 pointer-events-none">
                  <span className="text-[13px] font-medium" style={{ color: "#111827" }}>{roleSort}</span>
                  <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "#111827" }} />
                </div>
                <select
                  value={roleSort}
                  onChange={e => setRoleSort(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                >
                  <option value="All">All</option>
                  {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Flag cards */}
          <div className="flex flex-col gap-3 pb-10">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CheckCircle2 className="w-10 h-10 mb-3" style={{ color: "#1f6b43" }} />
                <p className="text-[15px] font-semibold" style={{ color: "#374151" }}>All clear!</p>
                <p className="text-[13px] mt-1" style={{ color: "#9ca3af" }}>No flags match the current filters.</p>
              </div>
            ) : (
              filtered.map((flag, i) => (
                <motion.div key={flag.id} custom={i} variants={fadeUp} initial="hidden" animate="visible">
                <FlagCard
                  flag={flag}
                  isSelected={selectedFlag?.id === flag.id}
                  isReviewing={reviewingId === flag.id}
                  escalationInfo={escalated.get(flag.id)}
                  onSelect={() => setSelectedId(flag.id)}
                  onViewDetail={setViewingFlag}
                  onMarkReviewed={handleMarkReviewed}
                  onEscalate={setEscalatingFlag}
                />
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.14, ease: [0.22, 1, 0.36, 1] }} className="w-[320px] shrink-0 flex flex-col min-h-0">
          <FlagDetailPanel
            flag={selectedFlag}
            escalationInfo={selectedFlag ? escalated.get(selectedFlag.id) : undefined}
            onMarkReviewed={handleMarkReviewed}
            onEscalate={setEscalatingFlag}
            onViewDetail={setViewingFlag}
          />
        </motion.div>
      </motion.div>

      {/* ── Modals ── */}
      {viewingFlag && (
        <FlagDetailModal
          flag={viewingFlag}
          escalationInfo={escalated.get(viewingFlag.id)}
          onClose={() => setViewingFlag(null)}
          onEscalate={setEscalatingFlag}
          onMarkReviewed={handleMarkReviewed}
        />
      )}
      {escalatingFlag && (
        <EscalateModal
          flag={escalatingFlag}
          onClose={() => setEscalatingFlag(null)}
          onSend={handleEscalateSend}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
