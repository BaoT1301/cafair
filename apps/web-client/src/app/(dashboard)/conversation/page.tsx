"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect, type ComponentType } from "react";
import {
  Search,
  Send,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { getInitials } from "@/lib/recruiter-utils";

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
  email: string | null;
  avatarUrl: string | null;
  summary: string | null;
  strengths: unknown;
  gaps: unknown;
};

type MsgType = "recruiter" | "candidate" | "ai-system" | "ai-draft";
type Message = {
  id: string;
  type: MsgType;
  text: string;
  time: string;
  read?: boolean;
};

/* ─── Mock message generator ─────────────────────────────────── */
function getStrengths(c: Candidate): string[] {
  return Array.isArray(c.strengths) ? (c.strengths as string[]) : [];
}
function getGaps(c: Candidate): string[] {
  return Array.isArray(c.gaps) ? (c.gaps as string[]) : [];
}

// Module-level cache so messages stay stable across re-renders
const MESSAGE_CACHE: Record<string, Message[]> = {};

function buildMessages(c: Candidate): Message[] {
  if (MESSAGE_CACHE[c.id]) return MESSAGE_CACHE[c.id];

  const first = c.name.split(" ")[0] ?? c.name;
  const stage = c.stage ?? "fair";
  const score = c.fitScore ?? 0;
  const skill = getStrengths(c)[0] ?? "software engineering";
  const msgs: Message[] = [];

  // Always: check-in event
  msgs.push({
    id: `${c.id}-0`,
    type: "ai-system",
    text: `${c.name} checked in at the career fair · AI Fit Score: ${score}%`,
    time: "9:04 AM",
  });

  // Recruiter opener
  msgs.push({
    id: `${c.id}-1`,
    type: "recruiter",
    text: `Hi ${first}! It was great meeting you at the fair today. We were really impressed by your background — especially your experience in ${skill}.`,
    time: "9:12 AM",
    read: true,
  });

  if (stage === "fair") {
    // AI draft follow-up only
    msgs.push({
      id: `${c.id}-2`,
      type: "ai-draft",
      text: `Hi ${first}, we'd love to learn more about your background. Are you available for a 20-minute call this week to discuss the ${c.role ?? "role"} further?`,
      time: "9:15 AM",
    });
    MESSAGE_CACHE[c.id] = msgs;
    return msgs;
  }

  // Candidate replied
  msgs.push({
    id: `${c.id}-3`,
    type: "candidate",
    text: `Thanks for reaching out! I really enjoyed our conversation at the fair. I'd love to continue the discussion about the ${c.role ?? "position"}.`,
    time: "10:31 AM",
    read: true,
  });

  if (stage === "screen") {
    msgs.push({
      id: `${c.id}-4`,
      type: "recruiter",
      text: "Perfect! Let's schedule a quick 20-minute phone screen. Does Thursday or Friday afternoon work for you?",
      time: "11:05 AM",
      read: true,
    });
    msgs.push({
      id: `${c.id}-5`,
      type: "candidate",
      text: "Thursday at 3 PM works great for me! Looking forward to it.",
      time: "11:22 AM",
      read: false,
    });
    msgs.push({
      id: `${c.id}-6`,
      type: "ai-system",
      text: "Phone screen scheduled · Thu 3:00 PM · AI detected positive engagement signal",
      time: "11:23 AM",
    });
    MESSAGE_CACHE[c.id] = msgs;
    return msgs;
  }

  msgs.push({
    id: `${c.id}-7`,
    type: "recruiter",
    text: "Phone screen confirmed for Thursday at 3 PM. Our recruiter will call you. The session will be about 30 minutes.",
    time: "11:15 AM",
    read: true,
  });
  msgs.push({
    id: `${c.id}-8`,
    type: "candidate",
    text: "Perfect, I'll be ready! Should I prepare anything specific?",
    time: "11:30 AM",
    read: true,
  });
  msgs.push({
    id: `${c.id}-9`,
    type: "recruiter",
    text: `Just bring your curiosity! We'll talk about your experience with ${skill} and walk through a couple of scenario questions. No prep needed.`,
    time: "11:45 AM",
    read: true,
  });

  if (stage === "interview") {
    msgs.push({
      id: `${c.id}-10`,
      type: "recruiter",
      text: "The phone screen went really well! We'd like to move forward with a technical interview. Sending a calendar invite for next week.",
      time: "4:05 PM",
      read: true,
    });
    msgs.push({
      id: `${c.id}-11`,
      type: "ai-system",
      text: "Interview stage reached · Recommendation: Fast-track · High engagement signal",
      time: "4:06 PM",
    });
    msgs.push({
      id: `${c.id}-12`,
      type: "candidate",
      text: "That's amazing news! I'm really excited about the opportunity. I look forward to the technical interview.",
      time: "4:18 PM",
      read: false,
    });
    MESSAGE_CACHE[c.id] = msgs;
    return msgs;
  }

  // offer / day1
  msgs.push({
    id: `${c.id}-13`,
    type: "recruiter",
    text: `${first}, we're excited to share that we'd like to extend an offer for the ${c.role ?? "position"}! You were our top candidate.`,
    time: "2:30 PM",
    read: true,
  });
  msgs.push({
    id: `${c.id}-14`,
    type: "candidate",
    text: "This is incredible! I'm so excited. I'd love to review the offer details — when can we discuss the compensation package?",
    time: "2:45 PM",
    read: true,
  });
  msgs.push({
    id: `${c.id}-15`,
    type: "ai-system",
    text: "Offer extended · Candidate response: Positive · Recommended follow-up within 24 hours",
    time: "2:46 PM",
  });

  MESSAGE_CACHE[c.id] = msgs;
  return msgs;
}

function getLastVisibleMessage(msgs: Message[]): Message | undefined {
  return [...msgs].reverse().find((m) => m.type !== "ai-system");
}

function getUnreadCount(msgs: Message[]): number {
  return msgs.filter((m) => m.type === "candidate" && !m.read).length;
}

/* ─── Stage config ───────────────────────────────────────────── */
const STAGE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  fair:      { label: "In Queue",   color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
  screen:    { label: "Screening",  color: "#b45309", bg: "#fef3c7", border: "#fcd34d" },
  interview: { label: "Interview",  color: "#0e3d27", bg: "#e8f5ee", border: "#86efac" },
  offer:     { label: "Offer",      color: "#1f6b43", bg: "#dcfce7", border: "#86efac" },
  day1:      { label: "Day 1",      color: "#1f6b43", bg: "#dcfce7", border: "#86efac" },
};

function StagePill({ stage }: { stage: string }) {
  const cfg = STAGE_CFG[stage] ?? STAGE_CFG.fair;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

/* ─── Conversation List Item ─────────────────────────────────── */
function ConversationItem({
  candidate,
  isActive,
  messages,
  onClick,
}: {
  candidate: Candidate;
  isActive: boolean;
  messages: Message[];
  onClick: () => void;
}) {
  const last = getLastVisibleMessage(messages);
  const unread = getUnreadCount(messages);
  const score = candidate.fitScore ?? 0;
  const stage = candidate.stage ?? "fair";
  const cfg = STAGE_CFG[stage] ?? STAGE_CFG.fair;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-border text-left transition-colors ${
        isActive ? "bg-[#e8f5ee] border-l-[3px] border-l-[#0e3d27]" : "hover:bg-muted/30 border-l-[3px] border-l-transparent"
      }`}
    >
      {/* Avatar with stage dot */}
      <div className="shrink-0 relative mt-0.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{
            background:
              score >= 85 ? "#0e3d27" : score >= 75 ? "#1f6b43" : score >= 65 ? "#52b788" : "#9ca3af",
          }}
        >
          {getInitials(candidate.name)}
        </div>
        <div
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ background: cfg.color }}
        />
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className={`text-sm truncate ${unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
            {candidate.name}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {unread > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#0e3d27] text-white text-[9px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{last?.time ?? ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <StagePill stage={stage} />
        </div>
        <p className={`text-[11px] truncate leading-relaxed ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {last
            ? `${last.type === "recruiter" ? "You: " : ""}${last.text.slice(0, 45)}${last.text.length > 45 ? "…" : ""}`
            : "No messages yet"}
        </p>
      </div>
    </button>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────── */
function MessageBubble({ msg }: { msg: Message }) {
  // AI system event
  if (msg.type === "ai-system") {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0fdf4] border border-[#86efac] shrink-0">
          <Bot className="w-3 h-3 text-[#0e3d27] shrink-0" />
          <span className="text-[10px] font-medium text-[#0e3d27] whitespace-nowrap">{msg.text}</span>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  // AI drafted message suggestion
  if (msg.type === "ai-draft") {
    return (
      <div className="flex flex-col gap-1.5 items-start">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#1f6b43]" />
          <span className="text-[10px] font-semibold text-[#1f6b43]">AI Suggested Draft</span>
        </div>
        <div className="max-w-[72%] px-4 py-3 rounded-2xl rounded-tl-sm bg-[#f0fdf4] border border-[#86efac] text-sm text-[#14532d] leading-relaxed">
          {msg.text}
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[11px] font-semibold text-[#0e3d27] bg-[#e8f5ee] border border-[#c5e4d1] px-2.5 py-1 rounded-md hover:bg-[#d1fae5] transition-colors">
            Use Draft
          </button>
          <button className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">
            Discard
          </button>
          <span className="text-[9px] text-muted-foreground">{msg.time}</span>
        </div>
      </div>
    );
  }

  const isRecruiter = msg.type === "recruiter";

  return (
    <div className={`flex flex-col gap-1 ${isRecruiter ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[72%] px-4 py-2.5 text-sm leading-relaxed ${
          isRecruiter
            ? "bg-[#0e3d27] text-white rounded-2xl rounded-tr-sm"
            : "bg-white border border-border text-foreground rounded-2xl rounded-tl-sm shadow-sm"
        }`}
      >
        {msg.text}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-muted-foreground">{msg.time}</span>
        {isRecruiter && msg.read && (
          <CheckCircle2 className="w-2.5 h-2.5 text-[#1f6b43]" />
        )}
      </div>
    </div>
  );
}

/* ─── Thread View (center panel) ─────────────────────────────── */
function ThreadView({
  candidate,
  messages,
}: {
  candidate: Candidate;
  messages: Message[];
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when candidate changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [candidate.id]);

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #0e3d27, #1f6b43)" }}
          >
            {getInitials(candidate.name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground">{candidate.name}</p>
              <StagePill stage={candidate.stage ?? "fair"} />
              <span className="text-[10px] font-semibold text-[#0e3d27]">
                {candidate.fitScore ?? 0}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {candidate.role ?? "Candidate"} · {candidate.school ?? "University"}
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 rounded-lg border border-border bg-card text-[11px] font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors">
            <Phone className="w-3 h-3" />
            Call
          </button>
          <button className="h-8 px-3 rounded-lg border border-border bg-card text-[11px] font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors">
            <Mail className="w-3 h-3" />
            Email
          </button>
          <button className="h-8 px-3 rounded-lg border border-border bg-card text-[11px] font-medium text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors">
            <Calendar className="w-3 h-3" />
            Schedule
          </button>
        </div>
      </div>

      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 bg-muted/10">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose area */}
      <div className="px-4 py-3.5 border-t border-border bg-card shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 border border-border rounded-xl bg-white px-3.5 py-2.5 focus-within:ring-1 focus-within:ring-[#1f6b43] focus-within:border-[#1f6b43] transition-all">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) setDraft("");
                }
              }}
              placeholder="Write a message… (Enter to send)"
              rows={2}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/50">
              <button className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0e3d27] hover:text-[#1f6b43] transition-colors">
                <Sparkles className="w-3 h-3" />
                AI Compose
              </button>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {draft.length}/500
              </span>
            </div>
          </div>
          <button
            disabled={!draft.trim()}
            onClick={() => setDraft("")}
            className="h-[72px] w-10 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-35 shadow-sm"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AI Insights Panel (right) ──────────────────────────────── */
function QuickActionButton({
  icon: Icon,
  label,
  primary,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  primary: boolean;
}) {
  if (primary) {
    return (
      <button
        className="w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold text-white shadow-sm"
        style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  }
  return (
    <button className="w-full h-9 rounded-lg border border-border flex items-center justify-center gap-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function AIInsightsPanel({ candidate }: { candidate: Candidate }) {
  const score = candidate.fitScore ?? 0;
  const stage = candidate.stage ?? "fair";
  const strengths = getStrengths(candidate);
  const gaps = getGaps(candidate);
  const hasRisk = candidate.riskLevel === "high" || candidate.riskLevel === "medium";

  const suggestedMessage =
    stage === "fair"
      ? `"Hi ${candidate.name.split(" ")[0]}, it was great meeting you! Are you available for a quick call this week?"`
      : stage === "screen"
      ? `"We'd love to move forward with a technical interview. Does next Tuesday or Wednesday work for you?"`
      : stage === "interview"
      ? `"We're very excited about your candidacy and would like to discuss next steps. Are you available tomorrow?"`
      : `"We're thrilled to extend an offer. When would be a good time to discuss the details?"`;

  const nextStep =
    stage === "fair"
      ? "Send initial follow-up within 24 hours to maintain engagement."
      : stage === "screen"
      ? "Complete phone screen within 48 hours. Schedule technical interview if qualified."
      : stage === "interview"
      ? "Debrief with hiring panel. Prepare offer package within 72 hours."
      : "Follow up on offer acceptance. Coordinate onboarding if accepted.";

  const actions: { icon: ComponentType<{ className?: string }>; label: string; primary: boolean }[] = [];
  if (stage === "fair") {
    actions.push({ icon: Phone, label: "Schedule Call", primary: true });
    actions.push({ icon: ChevronRight, label: "Move to Screening", primary: false });
  } else if (stage === "screen") {
    actions.push({ icon: Calendar, label: "Schedule Interview", primary: true });
    actions.push({ icon: Mail, label: "Send Summary", primary: false });
  } else if (stage === "interview") {
    actions.push({ icon: CheckCircle2, label: "Send Offer", primary: true });
    actions.push({ icon: Mail, label: "Draft Follow-up", primary: false });
  } else {
    actions.push({ icon: CheckCircle2, label: "Confirm Offer", primary: true });
    actions.push({ icon: Mail, label: "Onboarding Email", primary: false });
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto h-full px-4 py-4">

      {/* Score card */}
      <div
        className="rounded-[14px] p-4"
        style={{ background: "linear-gradient(135deg, #0e3d27 0%, #1f6b43 100%)" }}
      >
        <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-3">
          AI Candidate Score
        </p>
        <div className="flex items-end gap-3 mb-3">
          <span className="text-[38px] font-extrabold text-white leading-none">{score}%</span>
          <div className="pb-1">
            <p className="text-[11px] text-white/70 leading-none mb-1">Fit Score</p>
            <span
              className={`text-[11px] font-semibold ${
                hasRisk ? "text-[#abdd64]" : "text-[#86efac]"
              }`}
            >
              {!candidate.riskLevel || candidate.riskLevel === "low"
                ? "Low Risk"
                : candidate.riskLevel === "medium"
                ? "Medium Risk"
                : "High Risk"}
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/80 rounded-full"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* AI summary */}
      <div className="bg-card border border-border rounded-xl p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Bot className="w-3.5 h-3.5 text-[#0e3d27]" />
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">AI Summary</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {candidate.summary ??
            `${candidate.name} showed strong interest during the career fair. Engagement signals are positive. ${score >= 80 ? "Recommended to fast-track to interview stage." : "Standard follow-up recommended."}`}
        </p>
      </div>

      {/* Key strengths */}
      {strengths.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-2.5">
            Key Strengths
          </p>
          <div className="flex flex-col gap-2">
            {strengths.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-[#e8f5ee] border border-[#c5e4d1] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[8px] font-bold text-[#0e3d27]">✓</span>
                </div>
                <span className="text-xs text-foreground leading-relaxed">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk signals */}
      {hasRisk && gaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              Risk Signals
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {gaps.slice(0, 2).map((g, i) => (
              <p key={i} className="text-[11px] text-amber-800 leading-relaxed">{g}</p>
            ))}
          </div>
        </div>
      )}

      {/* Suggested message */}
      <div className="bg-[#f0fdf4] border border-[#86efac] rounded-xl p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-[#0e3d27]" />
          <p className="text-[10px] font-bold text-[#0e3d27] uppercase tracking-wider">
            Suggested Message
          </p>
        </div>
        <p className="text-[11px] text-[#14532d] leading-relaxed">{suggestedMessage}</p>
        <button className="mt-2.5 text-[11px] font-semibold text-[#0e3d27] bg-[#e8f5ee] border border-[#c5e4d1] px-2.5 py-1 rounded-md hover:bg-[#d1fae5] transition-colors">
          Use This
        </button>
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-xl p-3.5">
        <p className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-2.5">
          Quick Actions
        </p>
        <div className="flex flex-col gap-2">
          {actions.map((a, i) => (
            <QuickActionButton key={i} icon={a.icon} label={a.label} primary={a.primary} />
          ))}
        </div>
      </div>

      {/* Next step */}
      <div className="bg-card border border-border rounded-xl p-3.5">
        <p className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-2">
          Next Step
        </p>
        <div className="flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 text-[#0e3d27] shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">{nextStep}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Filter tabs ────────────────────────────────────────────── */
const FILTERS = ["All", "Interview", "Screening", "Unread"] as const;
type Filter = (typeof FILTERS)[number];

/* ─── Main Page ──────────────────────────────────────────────── */
export default function ConversationPage() {
  const trpc = useTRPC();
  const { data: rawCandidates, isLoading } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const candidates = rawCandidates as Candidate[] | undefined;

  // Build messages for all candidates
  const messageMap = useMemo(() => {
    const map: Record<string, Message[]> = {};
    (candidates ?? []).forEach((c) => {
      map[c.id] = buildMessages(c);
    });
    return map;
  }, [candidates]);

  // Filtered list (sorted by score desc)
  const filtered = useMemo(() => {
    if (!candidates) return [];
    let list = [...candidates].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
    if (search)
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.role ?? "").toLowerCase().includes(search.toLowerCase())
      );
    if (filter === "Interview")
      list = list.filter((c) => c.stage === "interview");
    else if (filter === "Screening")
      list = list.filter((c) => c.stage === "screen");
    else if (filter === "Unread")
      list = list.filter((c) => getUnreadCount(messageMap[c.id] ?? []) > 0);
    return list;
  }, [candidates, search, filter, messageMap]);

  const totalUnread = useMemo(
    () =>
      (candidates ?? []).reduce(
        (sum, c) => sum + getUnreadCount(messageMap[c.id] ?? []),
        0
      ),
    [candidates, messageMap]
  );

  // Default to first filtered candidate
  const effectiveId = activeId ?? filtered[0]?.id ?? null;
  const activeCandidate = candidates?.find((c) => c.id === effectiveId) ?? null;
  const activeMessages = effectiveId ? (messageMap[effectiveId] ?? []) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#1f6b43] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="flex bg-card border border-border rounded-xl overflow-hidden h-full"
    >
      {/* ── Left: Conversation list ── */}
      <div className="w-[272px] shrink-0 flex flex-col border-r border-border bg-card">
        {/* List header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-foreground">Messages</h2>
            {totalUnread > 0 && (
              <span className="h-5 px-1.5 min-w-[20px] rounded-full bg-[#0e3d27] text-white text-[10px] font-bold flex items-center justify-center">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates..."
              className="h-8 w-full rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#1f6b43] transition-all"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/20">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-colors ${
                filter === f
                  ? "bg-[#0e3d27] text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center px-4">
              <MessageSquare className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No conversations found</p>
            </div>
          ) : (
            filtered.map((c) => (
              <ConversationItem
                key={c.id}
                candidate={c}
                isActive={c.id === effectiveId}
                messages={messageMap[c.id] ?? []}
                onClick={() => setActiveId(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Center: Thread ── */}
      <div className="flex-1 min-w-0 flex flex-col bg-muted/5">
        {activeCandidate ? (
          <ThreadView candidate={activeCandidate} messages={activeMessages} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">No conversation selected</p>
              <p className="text-xs text-muted-foreground">Pick a candidate from the list to view the conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: AI insights ── */}
      <div className="w-[252px] shrink-0 border-l border-border bg-card flex flex-col">
        <div className="px-4 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-[#0e3d27]" />
            <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              AI Insights
            </p>
          </div>
          {activeCandidate && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {activeCandidate.name} · {activeCandidate.fitScore ?? 0}% match
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeCandidate ? (
            <AIInsightsPanel candidate={activeCandidate} />
          ) : (
            <div className="flex items-center justify-center h-full px-4 text-center">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Select a conversation to see AI-powered insights and suggested actions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
