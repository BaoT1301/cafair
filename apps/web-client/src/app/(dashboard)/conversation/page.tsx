"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect, useCallback, type ComponentType } from "react";
import {
  Search, Send, Sparkles, Calendar, CheckCircle2, AlertTriangle,
  Bot, Clock, Phone, Mail, MessageSquare, ChevronRight, X,
  MicOff, PhoneOff, Video,
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

/* ─── Helpers ────────────────────────────────────────────────── */

function getStrengths(c: Candidate): string[] {
  return Array.isArray(c.strengths) ? (c.strengths as string[]) : [];
}
function getGaps(c: Candidate): string[] {
  return Array.isArray(c.gaps) ? (c.gaps as string[]) : [];
}
function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* ─── Candidate reply simulation pool ───────────────────────── */

const CANDIDATE_REPLIES: Record<string, string[]> = {
  fair: [
    "Thanks for reaching out! I had a great time at the fair. I'd love to connect further — Thursday works great!",
    "Really appreciate the message! I'm very interested in learning more about the role. When works for you?",
    "Thanks! It was great meeting you too. I'm definitely interested — let me know when we can chat.",
  ],
  screen: [
    "I'm available Tuesday at 2 PM or Thursday morning. Which works better for you?",
    "Looking forward to it! I've been researching your company and I'm really excited about the direction you're headed.",
    "Sounds perfect! I'll make sure to block off that time. Should I prepare anything specific?",
  ],
  interview: [
    "Thank you so much! I'm really excited about this opportunity. I'll be ready for the technical interview.",
    "That's wonderful news! I've been preparing for this. Looking forward to our discussion next week.",
    "This is amazing — thank you! I have a few questions about the process. Can I send them over email?",
  ],
  offer: [
    "Wow, I'm thrilled! Could we schedule a call to walk through the offer details? I'm very excited.",
    "Thank you so much! I have a couple of questions about the equity portion. Are you free Friday afternoon?",
    "This is such great news! I'd love to discuss the relocation package if possible. When can we connect?",
  ],
  day1: [
    "I'm so excited to start! Do I need to bring anything specific on day one?",
    "Thank you! Looking forward to meeting the rest of the team. See you Monday!",
  ],
};

/* ─── Module-level initial message cache ─────────────────────── */

const INIT_CACHE: Record<string, Message[]> = {};

function buildInitialMessages(c: Candidate): Message[] {
  if (INIT_CACHE[c.id]) return INIT_CACHE[c.id];
  const first = c.name.split(" ")[0] ?? c.name;
  const stage = c.stage ?? "fair";
  const score = c.fitScore ?? 0;
  const skill = getStrengths(c)[0] ?? "software engineering";
  const msgs: Message[] = [];

  msgs.push({
    id: `${c.id}-0`, type: "ai-system",
    text: `${c.name} checked in at the career fair · AI Fit Score: ${score}%`,
    time: "9:04 AM",
  });
  msgs.push({
    id: `${c.id}-1`, type: "recruiter",
    text: `Hi ${first}! It was great meeting you at the fair today. We were really impressed by your background — especially your experience in ${skill}.`,
    time: "9:12 AM", read: true,
  });

  if (stage === "fair") {
    msgs.push({
      id: `${c.id}-2`, type: "ai-draft",
      text: `Hi ${first}, we'd love to learn more about your background. Are you available for a 20-minute call this week to discuss the ${c.role ?? "role"} further?`,
      time: "9:15 AM",
    });
    INIT_CACHE[c.id] = msgs; return msgs;
  }

  msgs.push({
    id: `${c.id}-3`, type: "candidate",
    text: `Thanks for reaching out! I really enjoyed our conversation at the fair. I'd love to continue the discussion about the ${c.role ?? "position"}.`,
    time: "10:31 AM", read: true,
  });

  if (stage === "screen") {
    msgs.push({ id: `${c.id}-4`, type: "recruiter", text: "Perfect! Let's schedule a quick 20-minute phone screen. Does Thursday or Friday afternoon work for you?", time: "11:05 AM", read: true });
    msgs.push({ id: `${c.id}-5`, type: "candidate", text: "Thursday at 3 PM works great for me! Looking forward to it.", time: "11:22 AM", read: false });
    msgs.push({ id: `${c.id}-6`, type: "ai-system", text: "Phone screen scheduled · Thu 3:00 PM · AI detected positive engagement signal", time: "11:23 AM" });
    INIT_CACHE[c.id] = msgs; return msgs;
  }

  msgs.push({ id: `${c.id}-7`, type: "recruiter", text: "Phone screen confirmed for Thursday at 3 PM. Our recruiter will call you. The session will be about 30 minutes.", time: "11:15 AM", read: true });
  msgs.push({ id: `${c.id}-8`, type: "candidate", text: "Perfect, I'll be ready! Should I prepare anything specific?", time: "11:30 AM", read: true });
  msgs.push({ id: `${c.id}-9`, type: "recruiter", text: `Just bring your curiosity! We'll talk about your experience with ${skill} and walk through a couple of scenario questions.`, time: "11:45 AM", read: true });

  if (stage === "interview") {
    msgs.push({ id: `${c.id}-10`, type: "recruiter", text: "The phone screen went really well! We'd like to move forward with a technical interview. Sending a calendar invite for next week.", time: "4:05 PM", read: true });
    msgs.push({ id: `${c.id}-11`, type: "ai-system", text: "Interview stage reached · Recommendation: Fast-track · High engagement signal", time: "4:06 PM" });
    msgs.push({ id: `${c.id}-12`, type: "candidate", text: "That's amazing news! I'm really excited about the opportunity. I look forward to the technical interview.", time: "4:18 PM", read: false });
    INIT_CACHE[c.id] = msgs; return msgs;
  }

  msgs.push({ id: `${c.id}-13`, type: "recruiter", text: `${first}, we're excited to share that we'd like to extend an offer for the ${c.role ?? "position"}! You were our top candidate.`, time: "2:30 PM", read: true });
  msgs.push({ id: `${c.id}-14`, type: "candidate", text: "This is incredible! I'm so excited. I'd love to review the offer details — when can we discuss the compensation package?", time: "2:45 PM", read: true });
  msgs.push({ id: `${c.id}-15`, type: "ai-system", text: "Offer extended · Candidate response: Positive · Recommended follow-up within 24 hours", time: "2:46 PM" });

  INIT_CACHE[c.id] = msgs; return msgs;
}

/* ─── Stage config ───────────────────────────────────────────── */

const STAGE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  fair:      { label: "In Queue",  color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
  screen:    { label: "Screening", color: "#b45309", bg: "#fef3c7", border: "#fcd34d" },
  interview: { label: "Interview", color: "#0e3d27", bg: "#e8f5ee", border: "#86efac" },
  offer:     { label: "Offer",     color: "#1f6b43", bg: "#dcfce7", border: "#86efac" },
  day1:      { label: "Day 1",     color: "#1f6b43", bg: "#dcfce7", border: "#86efac" },
};

function StagePill({ stage }: { stage: string }) {
  const cfg = STAGE_CFG[stage] ?? STAGE_CFG.fair;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  );
}

/* ─── Call Modal ─────────────────────────────────────────────── */

function CallModal({ candidate, onClose, onAddSystemMsg }: {
  candidate: Candidate;
  onClose: () => void;
  onAddSystemMsg: (text: string) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [ended]);

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function handleEnd() {
    setEnded(true);
    onAddSystemMsg(`Call ended · Duration: ${formatTime(elapsed)} · Logged to candidate record`);
    setTimeout(onClose, 1200);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="w-[320px] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{ background: "linear-gradient(160deg, #0e3d27 0%, #1f6b43 100%)" }}>
          <div className="flex flex-col items-center py-10 px-6 gap-4">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold text-white">
              {getInitials(candidate.name)}
            </div>
            <div className="text-center">
              <p className="text-[20px] font-bold text-white">{candidate.name}</p>
              <p className="text-[13px] text-white/60 mt-0.5">{candidate.role ?? "Candidate"}</p>
            </div>
            {!ended ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10">
                <div className="w-2 h-2 rounded-full bg-[#abdd64] animate-pulse" />
                <span className="text-[13px] font-semibold text-white">{formatTime(elapsed)}</span>
              </div>
            ) : (
              <p className="text-[13px] text-white/60">Call ended</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 px-6 pb-10">
            <button
              onClick={() => setMuted(m => !m)}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
              style={{ background: muted ? "#fff" : "rgba(255,255,255,0.15)" }}
            >
              <MicOff className="w-5 h-5" style={{ color: muted ? "#0e3d27" : "#fff" }} />
            </button>
            <button
              onClick={handleEnd}
              disabled={ended}
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all"
              style={{ background: ended ? "#6b7280" : "#ef4444" }}
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            <button
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <Video className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Schedule Modal ─────────────────────────────────────────── */

const TIME_SLOTS = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM"];

function ScheduleModal({ candidate, onClose, onAddSystemMsg }: {
  candidate: Candidate;
  onClose: () => void;
  onAddSystemMsg: (text: string) => void;
}) {
  const days = useMemo(() => {
    const arr = [];
    const now = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      arr.push({ label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), date: d });
    }
    return arr;
  }, []);

  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  function handleConfirm() {
    if (!selectedTime) return;
    const day = days[selectedDay].label;
    onAddSystemMsg(`Interview scheduled · ${day} at ${selectedTime} · Calendar invite sent to ${candidate.name}`);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-[500px] flex flex-col" style={{ maxHeight: "85vh" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#f0f0f0" }}>
            <div>
              <h2 className="text-[16px] font-bold" style={{ color: "#111827" }}>Schedule Interview</h2>
              <p className="text-[12px]" style={{ color: "#6b7280" }}>with {candidate.name}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-50"
              style={{ borderColor: "#e2e8e5", color: "#4b5563" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>Select Day</p>
              <div className="flex gap-2 flex-wrap">
                {days.map((d, i) => (
                  <button key={i} onClick={() => { setSelectedDay(i); setSelectedTime(null); }}
                    className="px-3 py-2 rounded-[10px] border text-[12px] font-medium transition-all"
                    style={{
                      borderColor: selectedDay === i ? "#1f6b43" : "#e2e8e5",
                      background: selectedDay === i ? "#e8f5ee" : "#fff",
                      color: selectedDay === i ? "#1f6b43" : "#374151",
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>Select Time</p>
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map(t => (
                  <button key={t} onClick={() => setSelectedTime(t)}
                    className="py-2 rounded-[10px] border text-[12px] font-medium transition-all"
                    style={{
                      borderColor: selectedTime === t ? "#1f6b43" : "#e2e8e5",
                      background: selectedTime === t ? "#1f6b43" : "#fff",
                      color: selectedTime === t ? "#fff" : "#374151",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "#f0f0f0" }}>
            <button onClick={onClose} className="px-4 py-2 rounded-[10px] border text-[13px] font-medium hover:bg-gray-50"
              style={{ borderColor: "#e2e8e5", color: "#4b5563" }}>Cancel</button>
            <button onClick={handleConfirm} disabled={!selectedTime}
              className="px-5 py-2 rounded-[10px] text-[13px] font-semibold text-white disabled:opacity-40"
              style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}>
              Confirm &amp; Send Invite
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Email Modal ────────────────────────────────────────────── */

function EmailModal({ candidate, onClose, onAddSystemMsg }: {
  candidate: Candidate;
  onClose: () => void;
  onAddSystemMsg: (text: string) => void;
}) {
  const [subject, setSubject] = useState(`Following up — ${candidate.role ?? "Role"} at FairSignal`);
  const [body, setBody] = useState(`Hi ${candidate.name.split(" ")[0]},\n\nThank you for your interest in the ${candidate.role ?? "position"}. We'd love to connect further.\n\nBest regards,\nThe Recruiting Team`);

  function handleSend() {
    onAddSystemMsg(`Email sent to ${candidate.name} · Subject: "${subject}"`);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-[520px] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#f0f0f0" }}>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" style={{ color: "#1f6b43" }} />
              <h2 className="text-[16px] font-bold" style={{ color: "#111827" }}>Send Email</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-50"
              style={{ borderColor: "#e2e8e5", color: "#4b5563" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#6b7280" }}>To</p>
              <div className="px-3 py-2 rounded-[10px] border text-[13px]"
                style={{ borderColor: "#e2e8e5", color: "#111827", background: "#f7f7f7" }}>
                {candidate.email ?? `${candidate.name.toLowerCase().replace(" ", ".")}@email.com`}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#6b7280" }}>Subject</p>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border text-[13px] focus:outline-none"
                style={{ borderColor: "#e2e8e5", color: "#111827" }}
                onFocus={e => (e.target.style.borderColor = "#1f6b43")}
                onBlur={e => (e.target.style.borderColor = "#e2e8e5")} />
            </div>
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#6b7280" }}>Message</p>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
                className="w-full px-3 py-2.5 rounded-[10px] border text-[13px] resize-none focus:outline-none"
                style={{ borderColor: "#e2e8e5", color: "#111827" }}
                onFocus={e => (e.target.style.borderColor = "#1f6b43")}
                onBlur={e => (e.target.style.borderColor = "#e2e8e5")} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "#f0f0f0" }}>
            <button onClick={onClose} className="px-4 py-2 rounded-[10px] border text-[13px] font-medium hover:bg-gray-50"
              style={{ borderColor: "#e2e8e5", color: "#4b5563" }}>Cancel</button>
            <button onClick={handleSend}
              className="flex items-center gap-2 px-5 py-2 rounded-[10px] text-[13px] font-semibold text-white"
              style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}>
              <Send className="w-3.5 h-3.5" />
              Send Email
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Typing indicator ───────────────────────────────────────── */

function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-white border shadow-sm"
        style={{ borderColor: "#e2e8e5" }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: "#9ca3af", animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      <span className="text-[9px]" style={{ color: "#9ca3af" }}>{name} is typing…</span>
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────── */

function MessageBubble({
  msg, onUseDraft, onDiscardDraft,
}: {
  msg: Message;
  onUseDraft?: (text: string) => void;
  onDiscardDraft?: (id: string) => void;
}) {
  if (msg.type === "ai-system") {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
          style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
          <Bot className="w-3 h-3 shrink-0" style={{ color: "#0e3d27" }} />
          <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: "#0e3d27" }}>{msg.text}</span>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  if (msg.type === "ai-draft") {
    return (
      <div className="flex flex-col gap-1.5 items-start">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" style={{ color: "#1f6b43" }} />
          <span className="text-[10px] font-semibold" style={{ color: "#1f6b43" }}>AI Suggested Draft</span>
        </div>
        <div className="max-w-[72%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
          style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#14532d" }}>
          {msg.text}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUseDraft?.(msg.text)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors"
            style={{ color: "#0e3d27", background: "#e8f5ee", border: "1px solid #c5e4d1" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#d1fae5")}
            onMouseLeave={e => (e.currentTarget.style.background = "#e8f5ee")}
          >
            Use Draft
          </button>
          <button
            onClick={() => onDiscardDraft?.(msg.id)}
            className="text-[11px] px-2 py-1 rounded-md transition-colors"
            style={{ color: "#9ca3af" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#374151")}
            onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
          >
            Discard
          </button>
          <span className="text-[9px]" style={{ color: "#9ca3af" }}>{msg.time}</span>
        </div>
      </div>
    );
  }

  const isRecruiter = msg.type === "recruiter";
  return (
    <div className={`flex flex-col gap-1 ${isRecruiter ? "items-end" : "items-start"}`}>
      <div className={`max-w-[72%] px-4 py-2.5 text-sm leading-relaxed ${
        isRecruiter
          ? "rounded-2xl rounded-tr-sm text-white"
          : "rounded-2xl rounded-tl-sm bg-white border shadow-sm"
      }`}
        style={{
          background: isRecruiter ? "#0e3d27" : undefined,
          borderColor: isRecruiter ? undefined : "#e2e8e5",
          color: isRecruiter ? "#fff" : "#111827",
        }}>
        {msg.text}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px]" style={{ color: "#9ca3af" }}>{msg.time}</span>
        {isRecruiter && msg.read && <CheckCircle2 className="w-2.5 h-2.5" style={{ color: "#1f6b43" }} />}
      </div>
    </div>
  );
}

/* ─── Thread View ────────────────────────────────────────────── */

function ThreadView({
  candidate, messages, isTyping, draft, onDraftChange, onSend, onAICompose,
  composing, onRemoveMsg, onCall, onEmail, onSchedule,
}: {
  candidate: Candidate;
  messages: Message[];
  isTyping: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: (text: string) => void;
  onAICompose: () => void;
  composing: boolean;
  onRemoveMsg: (id: string) => void;
  onCall: () => void;
  onEmail: () => void;
  onSchedule: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping, candidate.id]);

  function handleSend() {
    if (!draft.trim()) return;
    onSend(draft);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-card shrink-0" style={{ borderColor: "#e2e8e5" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #0e3d27, #1f6b43)" }}>
            {getInitials(candidate.name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={{ color: "#111827" }}>{candidate.name}</p>
              <StagePill stage={candidate.stage ?? "fair"} />
              <span className="text-[10px] font-semibold" style={{ color: "#1f6b43" }}>
                {candidate.fitScore ?? 0}%
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "#6b7280" }}>
              {candidate.role ?? "Candidate"} · {candidate.school ?? "University"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[
            { icon: Phone, label: "Call", action: onCall },
            { icon: Mail, label: "Email", action: onEmail },
            { icon: Calendar, label: "Schedule", action: onSchedule },
          ].map(({ icon: Icon, label, action }) => (
            <button key={label} onClick={action}
              className="h-8 px-3 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors hover:bg-[#f0faf4]"
              style={{ borderColor: "#e2e8e5", color: "#374151" }}>
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3"
        style={{ background: "rgba(247,247,247,0.5)" }}>
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onUseDraft={text => { onDraftChange(text); onRemoveMsg(msg.id); }}
            onDiscardDraft={onRemoveMsg}
          />
        ))}
        {isTyping && <TypingBubble name={candidate.name.split(" ")[0]} />}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="px-4 py-3.5 border-t bg-card shrink-0" style={{ borderColor: "#e2e8e5" }}>
        <div className="flex items-end gap-2">
          <div className="flex-1 border rounded-xl bg-white px-3.5 py-2.5 transition-all focus-within:ring-1"
            style={{ borderColor: "#e2e8e5" }}
            onFocus={() => {}}
          >
            <textarea
              value={draft}
              onChange={e => onDraftChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="w-full bg-transparent text-sm placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
              style={{ color: "#111827" }}
            />
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <button
                onClick={onAICompose}
                disabled={composing}
                className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50"
                style={{ color: "#0e3d27" }}
              >
                {composing ? (
                  <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#0e3d27", borderTopColor: "transparent" }} />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {composing ? "Generating…" : "AI Compose"}
              </button>
              <span className="text-[10px] tabular-nums" style={{ color: "#9ca3af" }}>{draft.length}/500</span>
            </div>
          </div>
          <button
            disabled={!draft.trim()}
            onClick={handleSend}
            className="h-[76px] w-10 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-35 shadow-sm"
            style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Conversation List Item ─────────────────────────────────── */

function getLastVisibleMsg(msgs: Message[]) {
  return [...msgs].reverse().find(m => m.type !== "ai-system");
}
function getUnreadCount(msgs: Message[]) {
  return msgs.filter(m => m.type === "candidate" && !m.read).length;
}

function ConversationItem({
  candidate, isActive, messages, onClick,
}: {
  candidate: Candidate; isActive: boolean; messages: Message[]; onClick: () => void;
}) {
  const last = getLastVisibleMsg(messages);
  const unread = getUnreadCount(messages);
  const score = candidate.fitScore ?? 0;
  const stage = candidate.stage ?? "fair";
  const cfg = STAGE_CFG[stage] ?? STAGE_CFG.fair;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3.5 border-b text-left transition-colors"
      style={{
        borderBottomColor: "#f0f0f0",
        background: isActive ? "#e8f5ee" : undefined,
        borderLeft: isActive ? "3px solid #0e3d27" : "3px solid transparent",
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = ""; }}
    >
      <div className="shrink-0 relative mt-0.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: score >= 85 ? "#0e3d27" : score >= 75 ? "#1f6b43" : score >= 65 ? "#52b788" : "#9ca3af" }}>
          {getInitials(candidate.name)}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ background: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className={`text-sm truncate ${unread > 0 ? "font-bold" : "font-medium"}`} style={{ color: "#111827" }}>
            {candidate.name}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {unread > 0 && (
              <span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                style={{ background: "#0e3d27" }}>
                {unread}
              </span>
            )}
            <span className="text-[10px]" style={{ color: "#9ca3af" }}>{last?.time ?? ""}</span>
          </div>
        </div>
        <StagePill stage={stage} />
        <p className="text-[11px] truncate leading-relaxed mt-0.5"
          style={{ color: unread > 0 ? "#111827" : "#6b7280", fontWeight: unread > 0 ? 500 : 400 }}>
          {last
            ? `${last.type === "recruiter" ? "You: " : ""}${last.text.slice(0, 45)}${last.text.length > 45 ? "…" : ""}`
            : "No messages yet"}
        </p>
      </div>
    </button>
  );
}

/* ─── AI Insights Panel ──────────────────────────────────────── */

function AIInsightsPanel({
  candidate, onUseMessage, onSchedule, onCall, onSystemMsg,
}: {
  candidate: Candidate;
  onUseMessage: (text: string) => void;
  onSchedule: () => void;
  onCall: () => void;
  onSystemMsg: (text: string) => void;
}) {
  const score = candidate.fitScore ?? 0;
  const stage = candidate.stage ?? "fair";
  const strengths = getStrengths(candidate);
  const gaps = getGaps(candidate);
  const hasRisk = candidate.riskLevel === "high" || candidate.riskLevel === "medium";
  const first = candidate.name.split(" ")[0];

  const suggestedText =
    stage === "fair" ? `Hi ${first}, it was great meeting you! Are you available for a quick call this week to discuss the ${candidate.role ?? "role"} further?`
    : stage === "screen" ? `Hi ${first}, we'd love to move forward with a technical interview. Does next Tuesday or Wednesday work for you?`
    : stage === "interview" ? `Hi ${first}, we're very excited about your candidacy and would like to discuss next steps. Are you available tomorrow?`
    : `Hi ${first}, we're thrilled to extend an offer. When would be a good time to discuss the details?`;

  const nextStep =
    stage === "fair" ? "Send initial follow-up within 24 hours to maintain engagement."
    : stage === "screen" ? "Complete phone screen within 48 hours. Schedule technical interview if qualified."
    : stage === "interview" ? "Debrief with hiring panel. Prepare offer package within 72 hours."
    : "Follow up on offer acceptance. Coordinate onboarding if accepted.";

  type Action = { icon: ComponentType<{ className?: string }>; label: string; primary: boolean; onClick: () => void };
  const actions: Action[] = [];
  if (stage === "fair") {
    actions.push({ icon: Phone, label: "Schedule Call", primary: true, onClick: onCall });
    actions.push({ icon: ChevronRight, label: "Move to Screening", primary: false, onClick: () => onSystemMsg(`${candidate.name} moved to Screening stage · Stage update logged`) });
  } else if (stage === "screen") {
    actions.push({ icon: Calendar, label: "Schedule Interview", primary: true, onClick: onSchedule });
    actions.push({ icon: Mail, label: "Send Summary", primary: false, onClick: () => onUseMessage(`Hi ${first}, great speaking with you today! Here's a quick summary of what we discussed and the next steps for your application.`) });
  } else if (stage === "interview") {
    actions.push({ icon: CheckCircle2, label: "Prepare Offer", primary: true, onClick: () => onUseMessage(`Hi ${first}, congratulations! We've been very impressed throughout the process and would like to move forward with an offer. When can we connect to discuss?`) });
    actions.push({ icon: Mail, label: "Draft Follow-up", primary: false, onClick: () => onUseMessage(`Hi ${first}, just wanted to follow up after our interview. We had wonderful feedback from the team and are finalizing next steps.`) });
  } else {
    actions.push({ icon: CheckCircle2, label: "Confirm Offer", primary: true, onClick: () => onSystemMsg(`Offer confirmed for ${candidate.name} · Onboarding triggered`) });
    actions.push({ icon: Mail, label: "Onboarding Email", primary: false, onClick: () => onUseMessage(`Hi ${first}, we're so excited to welcome you to the team! Please find attached your onboarding details and day-one instructions.`) });
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto h-full px-4 py-4">
      {/* Score card */}
      <div className="rounded-[14px] p-4" style={{ background: "linear-gradient(135deg, #0e3d27 0%, #1f6b43 100%)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
          AI Candidate Score
        </p>
        <div className="flex items-end gap-3 mb-3">
          <span className="text-[38px] font-extrabold text-white leading-none">{score}%</span>
          <div className="pb-1">
            <p className="text-[11px] leading-none mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Fit Score</p>
            <span className="text-[11px] font-semibold" style={{ color: hasRisk ? "#abdd64" : "#86efac" }}>
              {!candidate.riskLevel || candidate.riskLevel === "low" ? "Low Risk"
                : candidate.riskLevel === "medium" ? "Medium Risk" : "High Risk"}
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
          <div className="h-full rounded-full" style={{ width: `${score}%`, background: "rgba(255,255,255,0.8)" }} />
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-card border border-border rounded-xl p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Bot className="w-3.5 h-3.5" style={{ color: "#0e3d27" }} />
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#374151" }}>AI Summary</p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
          {candidate.summary ?? `${candidate.name} showed strong interest at the fair. ${score >= 80 ? "Recommended to fast-track to interview." : "Standard follow-up recommended."}`}
        </p>
      </div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: "#374151" }}>Key Strengths</p>
          <div className="flex flex-col gap-2">
            {strengths.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "#e8f5ee", border: "1px solid #c5e4d1" }}>
                  <span className="text-[8px] font-bold" style={{ color: "#0e3d27" }}>✓</span>
                </div>
                <span className="text-xs leading-relaxed" style={{ color: "#374151" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk signals */}
      {hasRisk && gaps.length > 0 && (
        <div className="rounded-xl p-3.5" style={{ background: "#fffbeb", border: "1px solid #fcd34d" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#d97706" }} />
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#92400e" }}>Risk Signals</p>
          </div>
          {gaps.slice(0, 2).map((g, i) => (
            <p key={i} className="text-[11px] leading-relaxed" style={{ color: "#92400e" }}>{g}</p>
          ))}
        </div>
      )}

      {/* Suggested message */}
      <div className="rounded-xl p-3.5" style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#0e3d27" }} />
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0e3d27" }}>Suggested Message</p>
        </div>
        <p className="text-[11px] leading-relaxed italic" style={{ color: "#14532d" }}>
          &ldquo;{suggestedText.replace(/^Hi \w+, /, "")}&rdquo;
        </p>
        <button
          onClick={() => onUseMessage(suggestedText)}
          className="mt-2.5 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors"
          style={{ color: "#0e3d27", background: "#e8f5ee", border: "1px solid #c5e4d1" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#d1fae5")}
          onMouseLeave={e => (e.currentTarget.style.background = "#e8f5ee")}
        >
          Use This
        </button>
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-xl p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: "#374151" }}>Quick Actions</p>
        <div className="flex flex-col gap-2">
          {actions.map((a, i) => {
            const Icon = a.icon;
            return a.primary ? (
              <button key={i} onClick={a.onClick}
                className="w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold text-white shadow-sm"
                style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}>
                <Icon className="w-3.5 h-3.5" />
                {a.label}
              </button>
            ) : (
              <button key={i} onClick={a.onClick}
                className="w-full h-9 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-medium transition-colors hover:bg-muted"
                style={{ borderColor: "#e2e8e5", color: "#374151" }}>
                <Icon className="w-3.5 h-3.5" />
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Next step */}
      <div className="bg-card border border-border rounded-xl p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#374151" }}>Next Step</p>
        <div className="flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#0e3d27" }} />
          <p className="text-[11px] leading-relaxed" style={{ color: "#6b7280" }}>{nextStep}</p>
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
  const { data: rawCandidates, isLoading } = useQuery(trpc.recruiter.getCandidates.queryOptions());
  const candidates = rawCandidates as Candidate[] | undefined;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [messageMap, setMessageMap] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const [showCall, setShowCall] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  // Initialize message map when candidates load
  useEffect(() => {
    if (!candidates) return;
    setMessageMap(prev => {
      const next = { ...prev };
      candidates.forEach(c => {
        if (!next[c.id]) next[c.id] = buildInitialMessages(c);
      });
      return next;
    });
  }, [candidates]);

  // Reset draft when switching candidates
  const prevActiveId = useRef<string | null>(null);
  useEffect(() => {
    if (activeId !== prevActiveId.current) {
      setDraft("");
      prevActiveId.current = activeId;
    }
  }, [activeId]);

  const filtered = useMemo(() => {
    if (!candidates) return [];
    let list = [...candidates].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.role ?? "").toLowerCase().includes(search.toLowerCase()));
    if (filter === "Interview") list = list.filter(c => c.stage === "interview");
    else if (filter === "Screening") list = list.filter(c => c.stage === "screen");
    else if (filter === "Unread") list = list.filter(c => getUnreadCount(messageMap[c.id] ?? []) > 0);
    return list;
  }, [candidates, search, filter, messageMap]);

  const totalUnread = useMemo(() =>
    (candidates ?? []).reduce((sum, c) => sum + getUnreadCount(messageMap[c.id] ?? []), 0),
    [candidates, messageMap]);

  const effectiveId = activeId ?? filtered[0]?.id ?? null;
  const activeCandidate = candidates?.find(c => c.id === effectiveId) ?? null;
  const activeMessages = effectiveId ? (messageMap[effectiveId] ?? []) : [];

  function addMessage(candidateId: string, msg: Message) {
    setMessageMap(prev => ({
      ...prev,
      [candidateId]: [...(prev[candidateId] ?? []), msg],
    }));
  }

  function addSystemMessage(text: string) {
    if (!effectiveId) return;
    addMessage(effectiveId, { id: `sys-${Date.now()}`, type: "ai-system", text, time: nowTime() });
  }

  function removeMessage(candidateId: string, msgId: string) {
    setMessageMap(prev => ({
      ...prev,
      [candidateId]: (prev[candidateId] ?? []).filter(m => m.id !== msgId),
    }));
  }

  function simulateCandidateReply(candidateId: string, stage: string) {
    setTyping(candidateId);
    const delay = 1500 + Math.random() * 1200;
    setTimeout(() => {
      setTyping(null);
      const pool = CANDIDATE_REPLIES[stage] ?? CANDIDATE_REPLIES.fair;
      const text = pool[Math.floor(Math.random() * pool.length)];
      addMessage(candidateId, {
        id: `reply-${Date.now()}`,
        type: "candidate",
        text,
        time: nowTime(),
        read: false,
      });
    }, delay);
  }

  function handleSend(text: string) {
    if (!effectiveId || !text.trim() || !activeCandidate) return;
    // Remove any ai-draft in this thread
    setMessageMap(prev => ({
      ...prev,
      [effectiveId]: (prev[effectiveId] ?? []).filter(m => m.type !== "ai-draft"),
    }));
    // Add recruiter message
    addMessage(effectiveId, {
      id: `sent-${Date.now()}`,
      type: "recruiter",
      text,
      time: nowTime(),
      read: false,
    });
    setDraft("");
    // Simulate candidate reply
    simulateCandidateReply(effectiveId, activeCandidate.stage ?? "fair");
  }

  const handleAICompose = useCallback(async () => {
    if (!activeCandidate) return;
    setComposing(true);
    await new Promise(r => setTimeout(r, 700));
    const stage = activeCandidate.stage ?? "fair";
    const first = activeCandidate.name.split(" ")[0];
    const messages: Record<string, string> = {
      fair: `Hi ${first}, it was wonderful meeting you at the career fair! We'd love to schedule a quick 20-minute call to discuss the ${activeCandidate.role ?? "role"} in more detail. Are you available this week?`,
      screen: `Hi ${first}, great speaking with you! We'd like to move forward with a technical interview. Could you let us know your availability for next week?`,
      interview: `Hi ${first}, we really enjoyed our conversations and the team has given excellent feedback. We'd love to discuss next steps. Are you available for a brief call tomorrow or Thursday?`,
      offer: `Hi ${first}, we're so excited about the possibility of you joining the team. We're ready to discuss the offer details. When would be a good time to connect?`,
      day1: `Hi ${first}, welcome aboard! We're thrilled to have you starting soon. Please let us know if you have any questions before your first day.`,
    };
    setDraft(messages[stage] ?? messages.fair);
    setComposing(false);
  }, [activeCandidate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#1f6b43", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="flex bg-card border border-border rounded-xl overflow-hidden h-full" style={{ borderColor: "#e2e8e5" }}>
      {/* Left: Conversation list */}
      <div className="w-[272px] shrink-0 flex flex-col border-r bg-card" style={{ borderColor: "#e2e8e5" }}>
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "#f0f0f0" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold" style={{ color: "#111827" }}>Messages</h2>
            {totalUnread > 0 && (
              <span className="h-5 px-1.5 min-w-[20px] rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                style={{ background: "#0e3d27" }}>
                {totalUnread}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "#9ca3af" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search candidates…"
              className="h-8 w-full rounded-lg border pl-8 pr-3 text-xs focus:outline-none focus:ring-1 transition-all"
              style={{ borderColor: "#e2e8e5", background: "rgba(0,0,0,0.02)", color: "#111827" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-0.5 px-3 py-2 border-b" style={{ borderColor: "#f0f0f0", background: "rgba(0,0,0,0.01)" }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="flex-1 py-1 rounded-md text-[10px] font-medium transition-colors"
              style={{
                background: filter === f ? "#0e3d27" : "transparent",
                color: filter === f ? "#fff" : "#6b7280",
              }}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center px-4">
              <MessageSquare className="w-7 h-7 mx-auto mb-2" style={{ color: "#d1d5db" }} />
              <p className="text-xs" style={{ color: "#9ca3af" }}>No conversations found</p>
            </div>
          ) : (
            filtered.map(c => (
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

      {/* Center: Thread */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ background: "rgba(247,247,247,0.3)" }}>
        {activeCandidate ? (
          <ThreadView
            candidate={activeCandidate}
            messages={activeMessages}
            isTyping={typing === effectiveId}
            draft={draft}
            onDraftChange={setDraft}
            onSend={handleSend}
            onAICompose={handleAICompose}
            composing={composing}
            onRemoveMsg={id => effectiveId && removeMessage(effectiveId, id)}
            onCall={() => setShowCall(true)}
            onEmail={() => setShowEmail(true)}
            onSchedule={() => setShowSchedule(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-5 h-5" style={{ color: "#9ca3af" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "#374151" }}>No conversation selected</p>
              <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>Pick a candidate from the list to view the conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: AI Insights */}
      <div className="w-[252px] shrink-0 border-l flex flex-col bg-card" style={{ borderColor: "#e2e8e5" }}>
        <div className="px-4 py-3.5 border-b shrink-0" style={{ borderColor: "#f0f0f0" }}>
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" style={{ color: "#0e3d27" }} />
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#374151" }}>AI Insights</p>
          </div>
          {activeCandidate && (
            <p className="text-[11px] mt-0.5" style={{ color: "#6b7280" }}>
              {activeCandidate.name} · {activeCandidate.fitScore ?? 0}% match
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeCandidate ? (
            <AIInsightsPanel
              candidate={activeCandidate}
              onUseMessage={text => setDraft(text)}
              onSchedule={() => setShowSchedule(true)}
              onCall={() => setShowCall(true)}
              onSystemMsg={addSystemMessage}
            />
          ) : (
            <div className="flex items-center justify-center h-full px-4 text-center">
              <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>
                Select a conversation to see AI-powered insights and suggested actions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCall && activeCandidate && (
        <CallModal
          candidate={activeCandidate}
          onClose={() => setShowCall(false)}
          onAddSystemMsg={addSystemMessage}
        />
      )}
      {showSchedule && activeCandidate && (
        <ScheduleModal
          candidate={activeCandidate}
          onClose={() => setShowSchedule(false)}
          onAddSystemMsg={addSystemMessage}
        />
      )}
      {showEmail && activeCandidate && (
        <EmailModal
          candidate={activeCandidate}
          onClose={() => setShowEmail(false)}
          onAddSystemMsg={addSystemMessage}
        />
      )}
    </div>
  );
}
