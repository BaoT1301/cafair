"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
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
  ChevronLeft,
  Clock,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Database,
  Sparkles,
  MessageSquare,
  UserCheck,
  Zap,
  Filter,
  Upload,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: Math.min(i, 10) * 0.045, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/* ─── Types ──────────────────────────────────────────────── */

type ApprovalPriority = "HIGH PRIORITY" | "MEDIUM PRIORITY" | "LOW PRIORITY";
type ApprovalCategory = "SHORTLIST" | "OFFER" | "REJECTIONS" | "SCHEDULING";

interface Approval {
  id: string;
  priority: ApprovalPriority;
  category: ApprovalCategory;
  title: string;
  description: string;
  metaIcon: "users" | "file";
  meta1: string;
  meta2: string;
  editLabel: string;
  highlighted: boolean;
}

/* ─── Mock Data ──────────────────────────────────────────────── */

const MOCK_APPROVALS_ALL: Approval[] = [
  {
    id: "1",
    priority: "HIGH PRIORITY",
    category: "SHORTLIST",
    title: "Approve shortlist for Product Manager role",
    description:
      "AI ranked 3 candidates as strong matches (88–92% fit). Ready for interview scheduling.",
    metaIcon: "users",
    meta1: "3 candidates",
    meta2: "Flagged 4 hours ago",
    editLabel: "Edit",
    highlighted: true,
  },
  {
    id: "2",
    priority: "HIGH PRIORITY",
    category: "OFFER",
    title: "Approve offer letter draft for Sarah Chen",
    description:
      "Offer: $165K base + equity. Drafted based on compensation band and candidate expectations.",
    metaIcon: "file",
    meta1: "Senior Software Engineer",
    meta2: "Flagged 1 hour ago",
    editLabel: "Edit Terms",
    highlighted: false,
  },
  {
    id: "3",
    priority: "MEDIUM PRIORITY",
    category: "REJECTIONS",
    title: "Approve 12 auto-rejections for Software Engineer",
    description:
      "Candidates scored below 65% match threshold. System drafted rejection emails.",
    metaIcon: "users",
    meta1: "12 candidates",
    meta2: "Flagged 6 hours ago",
    editLabel: "Review",
    highlighted: false,
  },
  {
    id: "4",
    priority: "MEDIUM PRIORITY",
    category: "SCHEDULING",
    title: "Confirm 5 interview slots for Wednesday",
    description:
      "AI matched 5 candidates to open calendar slots. Needs your confirmation to send invites.",
    metaIcon: "users",
    meta1: "5 slots",
    meta2: "Flagged 2 hours ago",
    editLabel: "Edit Slots",
    highlighted: false,
  },
  {
    id: "5",
    priority: "LOW PRIORITY",
    category: "SHORTLIST",
    title: "Review extended shortlist for Data Analyst",
    description:
      "3 borderline candidates (72–75% fit) pending human review before advancing.",
    metaIcon: "users",
    meta1: "3 candidates",
    meta2: "Flagged 8 hours ago",
    editLabel: "Review",
    highlighted: false,
  },
  {
    id: "6",
    priority: "HIGH PRIORITY",
    category: "OFFER",
    title: "Approve counter-offer for Marcus Lee",
    description:
      "Candidate requested $10K above band. Manager approval required before responding.",
    metaIcon: "file",
    meta1: "Senior ML Engineer",
    meta2: "Flagged 30 minutes ago",
    editLabel: "Edit Terms",
    highlighted: false,
  },
  {
    id: "7",
    priority: "MEDIUM PRIORITY",
    category: "REJECTIONS",
    title: "Approve 6 auto-rejections for UX Designer",
    description:
      "Candidates scored below 60% match threshold. System drafted personalized rejection emails.",
    metaIcon: "users",
    meta1: "6 candidates",
    meta2: "Flagged 5 hours ago",
    editLabel: "Review",
    highlighted: false,
  },
  {
    id: "8",
    priority: "LOW PRIORITY",
    category: "SCHEDULING",
    title: "Reschedule 2 missed interview slots",
    description:
      "2 candidates did not confirm their allocated time. Alternative slots proposed.",
    metaIcon: "users",
    meta1: "2 candidates",
    meta2: "Flagged yesterday",
    editLabel: "Reschedule",
    highlighted: false,
  },
];

const MOCK_TASKS = [
  {
    id: "t1",
    group: "urgent",
    icon: "alert",
    title: "Review shortlist for PM role",
    subtitle: "3 candidates awaiting your decision",
    link: null as string | null,
  },
  {
    id: "t2",
    group: "urgent",
    icon: "offer",
    title: "Approve offer for Sarah Chen",
    subtitle: "$165K offer — needs sign-off today",
    link: null as string | null,
  },
  {
    id: "t3",
    group: "today",
    icon: "calendar",
    title: "Schedule 5 interviews for Wednesday",
    subtitle: "Calendar slots confirmed, invites pending",
    link: null as string | null,
  },
  {
    id: "t4",
    group: "today",
    icon: "mail",
    title: "Send rejection emails (12)",
    subtitle: "Auto-drafted, pending your review",
    link: null as string | null,
  },
  {
    id: "t5",
    group: "today",
    icon: "sync",
    title: "Sync 8 candidates to ATS",
    subtitle: "Greenhouse integration ready",
    link: null as string | null,
  },
  {
    id: "t6",
    group: "later",
    icon: "users",
    title: "Review pre-fair candidate pool",
    subtitle: "24 applicants imported",
    link: "/recruiter/candidates",
  },
  {
    id: "t7",
    group: "later",
    icon: "settings",
    title: "Update rubric for Engineering roles",
    subtitle: "Last updated 2 weeks ago",
    link: "/recruiter/settings",
  },
];

const MOCK_LOG_ITEMS = [
  { label: "Pulled 24 new applicants from Handshake", time: "2 minutes ago", type: "import" },
  { label: "Flagged 2 skill mismatches on ML Engineer role", time: "5 minutes ago", type: "flag" },
  { label: "Auto-scored 24 candidates via Nova AI", time: "12 minutes ago", type: "score" },
  { label: "Drafted 12 rejection emails for review", time: "18 minutes ago", type: "draft" },
  { label: "Synced 6 accepted candidates to Greenhouse", time: "45 minutes ago", type: "sync" },
  { label: "Scheduled 3 interviews for Tuesday", time: "1 hour ago", type: "calendar" },
  { label: "Shortlist approved for Data Analyst", time: "2 hours ago", type: "approved" },
  { label: "Offer letter generated for Marcus Lee", time: "3 hours ago", type: "offer" },
  { label: "Pulled batch of 8 candidates for PM role", time: "4 hours ago", type: "import" },
  { label: "Risk flags cleared for 2 borderline candidates", time: "5 hours ago", type: "flag" },
];

const MOCK_SHORTLIST_CANDIDATES = [
  { id: "c1", name: "Alex Kumar", score: 92, school: "MIT", role: "Product Manager", checked: true },
  { id: "c2", name: "Jordan Davis", score: 89, school: "Stanford", role: "Product Manager", checked: true },
  { id: "c3", name: "Riley Park", score: 88, school: "UC Berkeley", role: "Product Manager", checked: true },
];

const MOCK_REJECTION_CANDIDATES = [
  { id: "r1", name: "Casey Morgan", score: 58, reason: "Below threshold" },
  { id: "r2", name: "Drew Nguyen", score: 61, reason: "Missing required skills" },
  { id: "r3", name: "Avery Smith", score: 54, reason: "Insufficient experience" },
  { id: "r4", name: "Taylor Wong", score: 62, reason: "Below threshold" },
  { id: "r5", name: "Quinn Johnson", score: 55, reason: "Missing required skills" },
  { id: "r6", name: "Sam Rivera", score: 60, reason: "Below threshold" },
];

const MOCK_ACTIVITY = [
  { label: "Pulled 24 new applicants", time: "2 minutes ago" },
  { label: "Flagged 2 skill mismatches", time: "5 minutes ago" },
];

/* ─── Calendar Popover ───────────────────────────────────── */

type GCalEvent = { id: string; title: string; start: string; end: string; htmlLink: string };

function formatEventTime(iso: string) {
  if (!iso) return "";
  // all-day events are YYYY-MM-DD, not ISO
  if (iso.length === 10) return "All day";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function CalendarPopover({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const [viewMonth, setViewMonth] = useState(month);
  const [viewYear, setViewYear] = useState(year);
  const [selectedDay, setSelectedDay] = useState(today);

  // Google Calendar state
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null); // null = loading
  const [eventsLoading, setEventsLoading] = useState(false);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const isSelected = (d: number) => d === selectedDay && viewMonth === month && viewYear === year;
  const isToday = (d: number) => d === today && viewMonth === month && viewYear === year;

  // Fetch events whenever selected date changes
  useEffect(() => {
    const date = new Date(viewYear, viewMonth, selectedDay);
    const dateStr = date.toISOString().split("T")[0];
    setEventsLoading(true);
    fetch(`/api/google-calendar/events?date=${dateStr}`)
      .then(r => r.json())
      .then((data: { connected: boolean; events: GCalEvent[] }) => {
        setGcalConnected(data.connected);
        setGcalEvents(data.events ?? []);
      })
      .catch(() => setGcalConnected(false))
      .finally(() => setEventsLoading(false));
  }, [selectedDay, viewMonth, viewYear]);

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const selectedLabel = new Date(viewYear, viewMonth, selectedDay)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <motion.div
      ref={ref}
      className="absolute top-12 right-0 z-50 w-80 bg-white rounded-2xl border border-[#e2e8e5] p-4 flex flex-col gap-4 shadow-lg"
      initial={{ opacity: 0, scale: 0.93, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
            else setViewMonth(m => m - 1);
          }}
          className="w-7 h-7 rounded-lg border border-[#e2e8e5] flex items-center justify-center hover:bg-[#f7f7f7] transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-[#4b5563]" />
        </button>
        <span className="text-[13px] font-semibold text-[#111827]">{monthName}</span>
        <button
          onClick={() => {
            if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
            else setViewMonth(m => m + 1);
          }}
          className="w-7 h-7 rounded-lg border border-[#e2e8e5] flex items-center justify-center hover:bg-[#f7f7f7] transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5 text-[#4b5563]" />
        </button>
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#9ca3af] py-1">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            onClick={() => day && setSelectedDay(day)}
            className={`flex items-center justify-center h-8 rounded-full text-[12px] transition-colors ${
              day === null ? "" :
              isSelected(day) && isToday(day) ? "bg-[#0e3d27] text-white font-bold cursor-pointer" :
              isSelected(day) ? "bg-[#e8f5ee] text-[#0e3d27] font-semibold cursor-pointer" :
              isToday(day)    ? "bg-[#1f6b43] text-white font-bold cursor-pointer" :
              "text-[#374151] hover:bg-[#f0faf4] cursor-pointer"
            }`}
          >
            {day ?? ""}
          </div>
        ))}
      </div>

      {/* Events for selected day */}
      <div className="border-t border-[#f0f0f0] pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
            {selectedLabel}
          </p>
          {gcalConnected === false && (
            <a
              href="/api/google-calendar"
              className="text-[10px] font-semibold text-[#0e3d27] hover:underline"
            >
              Connect Google Calendar
            </a>
          )}
        </div>

        {eventsLoading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[#0e3d27] border-t-transparent animate-spin" />
            <span className="text-[11px] text-[#9ca3af]">Loading events…</span>
          </div>
        ) : gcalConnected && gcalEvents.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
            {gcalEvents.map((ev) => (
              <a
                key={ev.id}
                href={ev.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:bg-[#f7f7f7] rounded-lg px-1 py-0.5 transition-colors group"
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#1f6b43]" />
                <span className="text-[11px] text-[#6b7280] w-14 shrink-0 tabular-nums">
                  {formatEventTime(ev.start)}
                </span>
                <span className="text-[12px] text-[#111827] truncate group-hover:text-[#0e3d27]">
                  {ev.title}
                </span>
              </a>
            ))}
          </div>
        ) : gcalConnected && gcalEvents.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af]">No events on this day.</p>
        ) : (
          <p className="text-[11px] text-[#9ca3af] leading-relaxed">
            Connect Google Calendar to see your real schedule here.
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Tasks Panel (right slide-in drawer) ────────────────── */

function TasksPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const groups = [
    { key: "urgent", label: "Urgent", color: "#991b1b" },
    { key: "today", label: "Due Today", color: "#92400e" },
    { key: "later", label: "Upcoming", color: "#6b7280" },
  ];

  const iconFor = (icon: string) => {
    switch (icon) {
      case "alert": return <AlertTriangle className="w-3.5 h-3.5" />;
      case "offer": return <FileText className="w-3.5 h-3.5" />;
      case "calendar": return <Calendar className="w-3.5 h-3.5" />;
      case "mail": return <Mail className="w-3.5 h-3.5" />;
      case "sync": return <Zap className="w-3.5 h-3.5" />;
      case "users": return <Users className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/20"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed top-0 right-0 bottom-0 z-50 w-[380px] bg-white flex flex-col"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <div>
            <h2 className="text-[18px] font-bold text-[#111827]">My Tasks</h2>
            <p className="text-[12px] text-[#6b7280]">
              {MOCK_TASKS.length - completedTasks.size} tasks remaining
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-[#e2e8e5] flex items-center justify-center text-[#4b5563] hover:bg-[#f7f7f7] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {groups.map(group => {
            const tasks = MOCK_TASKS.filter(t => t.group === group.key);
            return (
              <div key={group.key}>
                <p
                  className="text-[11px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: group.color }}
                >
                  {group.label}
                </p>
                <div className="flex flex-col gap-2">
                  {tasks.map(task => {
                    const done = completedTasks.has(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                          done
                            ? "border-[#e8f5ee] bg-[#f0faf4] opacity-60"
                            : "border-[#e2e8e5] bg-white hover:border-[#1f6b43] cursor-pointer"
                        }`}
                        onClick={() => {
                          if (task.link) { router.push(task.link); onClose(); }
                          else setCompletedTasks(prev => new Set([...prev, task.id]));
                        }}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            done ? "bg-[#1f6b43] text-white" : "bg-[#f7f7f7] text-[#4b5563]"
                          }`}
                        >
                          {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : iconFor(task.icon)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[13px] font-semibold leading-tight ${
                              done ? "line-through text-[#9ca3af]" : "text-[#111827]"
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="text-[11px] text-[#6b7280] mt-0.5">{task.subtitle}</p>
                        </div>
                        {!done && (
                          <ChevronRight className="w-4 h-4 text-[#9ca3af] shrink-0 mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-[#f0f0f0]">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors"
            style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Import Modal ───────────────────────────────────────── */

function ImportModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"csv" | "ats" | "manual">("csv");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());

  const ATS_SYSTEMS = [
    { id: "greenhouse", name: "Greenhouse", logo: "🌿" },
    { id: "workday", name: "Workday", logo: "☁️" },
    { id: "lever", name: "Lever", logo: "⚡" },
    { id: "handshake", name: "Handshake", logo: "🤝" },
  ];

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-2xl w-[520px] flex flex-col overflow-hidden"
          initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
            <div>
              <h2 className="text-[18px] font-bold text-[#111827]">Import Candidates</h2>
              <p className="text-[12px] text-[#6b7280]">Add candidates to your pipeline</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-[#e2e8e5] flex items-center justify-center text-[#4b5563] hover:bg-[#f7f7f7] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#f0f0f0] px-6">
            {(["csv", "ats", "manual"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 px-4 text-[13px] font-semibold border-b-2 transition-colors -mb-px ${
                  tab === t
                    ? "border-[#1f6b43] text-[#1f6b43]"
                    : "border-transparent text-[#6b7280] hover:text-[#374151]"
                }`}
              >
                {t === "csv" ? "Upload CSV" : t === "ats" ? "Connect ATS" : "Manual Entry"}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-6">
            {tab === "csv" && (
              <div className="flex flex-col gap-4">
                <div
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                    dragging ? "border-[#1f6b43] bg-[#e8f5ee]" : "border-[#e2e8e5] hover:border-[#1f6b43] hover:bg-[#f7faf9]"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f) setFileName(f.name);
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".csv";
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) setFileName(f.name);
                    };
                    input.click();
                  }}
                >
                  <Upload className="w-8 h-8 text-[#9ca3af]" />
                  {fileName ? (
                    <p className="text-[13px] font-semibold text-[#1f6b43]">{fileName}</p>
                  ) : (
                    <>
                      <p className="text-[13px] font-semibold text-[#374151]">
                        Drop your CSV here, or click to browse
                      </p>
                      <p className="text-[11px] text-[#9ca3af]">
                        Supports: .csv · Max 10MB · Up to 500 candidates
                      </p>
                    </>
                  )}
                </div>
                <div className="bg-[#f7f7f7] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-[#4b5563] mb-1">Required columns:</p>
                  <p className="text-[11px] text-[#6b7280]">
                    name, email, school, role, resume_text
                  </p>
                  <p className="text-[11px] text-[#9ca3af] mt-1">
                    Optional: fit_score, stage, linkedin_url
                  </p>
                </div>
              </div>
            )}

            {tab === "ats" && (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-[#6b7280]">
                  Connect an ATS to auto-sync candidates from your existing pipeline.
                </p>
                {ATS_SYSTEMS.map(sys => {
                  const isConnected = connected.has(sys.id);
                  return (
                    <div
                      key={sys.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isConnected ? "border-[#1f6b43] bg-[#e8f5ee]" : "border-[#e2e8e5] bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{sys.logo}</span>
                        <span className="text-[13px] font-semibold text-[#111827]">{sys.name}</span>
                      </div>
                      <button
                        onClick={() =>
                          setConnected(prev => {
                            const next = new Set(prev);
                            if (next.has(sys.id)) next.delete(sys.id);
                            else next.add(sys.id);
                            return next;
                          })
                        }
                        className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                          isConnected
                            ? "bg-[#1f6b43] text-white"
                            : "border border-[#1f6b43] text-[#1f6b43] hover:bg-[#e8f5ee]"
                        }`}
                      >
                        {isConnected ? "Connected ✓" : "Connect"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "manual" && (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-[#6b7280]">
                  Manually enter candidate details one at a time.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {["Name", "Email", "School", "Role"].map(label => (
                    <div key={label}>
                      <label className="block text-[11px] font-semibold text-[#4b5563] mb-1">
                        {label}
                      </label>
                      <input
                        type="text"
                        placeholder={`Enter ${label.toLowerCase()}…`}
                        className="w-full px-3 py-2 rounded-lg border border-[#e2e8e5] text-[13px] text-[#111827] focus:outline-none focus:border-[#1f6b43] transition-colors"
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#4b5563] mb-1">
                    Resume / Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Paste resume highlights or notes…"
                    className="w-full px-3 py-2 rounded-lg border border-[#e2e8e5] text-[13px] text-[#111827] focus:outline-none focus:border-[#1f6b43] transition-colors resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f0f0]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#e2e8e5] text-[13px] font-medium text-[#4b5563] hover:bg-[#f7f7f7] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors"
              style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}
            >
              {tab === "csv" ? "Import CSV" : tab === "ats" ? "Sync Now" : "Add Candidate"}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

/* ─── Insights Chat Panel ────────────────────────────────── */

function InsightsChatPanel({ onClose }: { onClose: () => void }) {
  type ChatMessage = { role: "ai" | "user"; text: string };
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: "Hi! I'm your AI recruiting copilot. Ask me anything about your pipeline, candidates, or hiring goals." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const SUGGESTIONS = [
    "Which candidates should I advance today?",
    "How is the PM role pipeline looking?",
    "Who are the top 3 candidates for software engineering?",
  ];

  const MOCK_RESPONSES: Record<string, string> = {
    default: "Based on your current pipeline, I'd recommend prioritizing the 3 candidates with 88%+ fit scores in the Product Manager shortlist. They're ready for interview scheduling and have strong alignment with your rubric criteria.",
  };

  function send(text: string) {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      setMessages(m => [...m, { role: "ai", text: MOCK_RESPONSES.default }]);
      setLoading(false);
    }, 1200);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
      <motion.div
        className="fixed top-0 right-0 bottom-0 z-50 w-[400px] bg-white flex flex-col"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#e8f5ee] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#1f6b43]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#111827]">AI Insights</h2>
              <p className="text-[11px] text-[#6b7280]">Powered by Nova AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-[#e2e8e5] flex items-center justify-center text-[#4b5563] hover:bg-[#f7f7f7] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#1f6b43] text-white rounded-br-sm"
                    : "bg-[#f7f7f7] text-[#111827] rounded-bl-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#f7f7f7] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-5 pb-3 flex flex-col gap-2">
            <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
              Suggestions
            </p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                className="text-left text-[12px] text-[#374151] px-3 py-2 rounded-xl border border-[#e2e8e5] hover:border-[#1f6b43] hover:bg-[#f0faf4] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-4 border-t border-[#f0f0f0] flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(input); }}
            placeholder="Ask for insights or updates…"
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#e2e8e5] text-[13px] text-[#111827] focus:outline-none focus:border-[#1f6b43] transition-colors"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Review All Modal ───────────────────────────────────── */

type ReviewFilter = "all" | "SHORTLIST" | "OFFER" | "REJECTIONS" | "SCHEDULING";

function ReviewAllModal({
  approvedIds,
  dismissedIds,
  onApprove,
  onDismiss,
  onEdit,
  onClose,
}: {
  approvedIds: Set<string>;
  dismissedIds: Set<string>;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
  onEdit: (approval: Approval) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const filters: { key: ReviewFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "SHORTLIST", label: "Shortlist" },
    { key: "OFFER", label: "Offer" },
    { key: "REJECTIONS", label: "Rejections" },
    { key: "SCHEDULING", label: "Scheduling" },
  ];

  const visible = MOCK_APPROVALS_ALL.filter(a => {
    if (dismissedIds.has(a.id)) return false;
    if (filter === "all") return true;
    return a.category === filter;
  });

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <motion.div
          className="bg-white rounded-2xl w-full max-w-2xl flex flex-col"
          style={{ maxHeight: "90vh" }}
          initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0] shrink-0">
            <div>
              <h2 className="text-[20px] font-bold text-[#111827]">Pending Approvals</h2>
              <p className="text-[12px] text-[#6b7280]">
                {visible.filter(a => !approvedIds.has(a.id)).length} decisions awaiting confirmation
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-[#e2e8e5] flex items-center justify-center text-[#4b5563] hover:bg-[#f7f7f7] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0 border-b border-[#f0f0f0] px-6 shrink-0">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`py-3 px-3 text-[12px] font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  filter === f.key
                    ? "border-[#1f6b43] text-[#1f6b43]"
                    : "border-transparent text-[#6b7280] hover:text-[#374151]"
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-[10px] bg-[#f7f7f7] text-[#9ca3af] px-1.5 py-0.5 rounded-full">
                  {f.key === "all"
                    ? MOCK_APPROVALS_ALL.filter(a => !dismissedIds.has(a.id)).length
                    : MOCK_APPROVALS_ALL.filter(a => a.category === f.key && !dismissedIds.has(a.id)).length}
                </span>
              </button>
            ))}
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
            {visible.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="w-10 h-10 text-[#1f6b43] mb-3" />
                <p className="text-[15px] font-semibold text-[#374151]">All caught up!</p>
                <p className="text-[13px] text-[#9ca3af]">No pending approvals in this category.</p>
              </div>
            )}
            {visible.map(a => (
              <ApprovalCard
                key={a.id}
                {...a}
                isApproved={approvedIds.has(a.id)}
                onApprove={() => onApprove(a.id)}
                onDismiss={() => onDismiss(a.id)}
                onEdit={() => onEdit(a)}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}

/* ─── Approval Edit Modal ────────────────────────────────── */

function ApprovalEditModal({
  approval,
  onClose,
}: {
  approval: Approval;
  onClose: () => void;
}) {
  const [shortlist, setShortlist] = useState(MOCK_SHORTLIST_CANDIDATES);
  const [rejectList, setRejectList] = useState(MOCK_REJECTION_CANDIDATES);
  const [salary, setSalary] = useState("165,000");
  const [equity, setEquity] = useState("0.15");

  return (
    <>
      <motion.div className="fixed inset-0 z-60 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-2xl w-[520px] flex flex-col"
          style={{ maxHeight: "85vh" }}
          initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0] shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#1f6b43] text-white">
                  {approval.category}
                </span>
              </div>
              <h2 className="text-[16px] font-bold text-[#111827]">{approval.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-[#e2e8e5] flex items-center justify-center text-[#4b5563] hover:bg-[#f7f7f7] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* SHORTLIST: candidate checklist */}
            {approval.category === "SHORTLIST" && (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-[#6b7280]">
                  Review AI-ranked candidates and uncheck any you want to exclude before approving.
                </p>
                {shortlist.map(c => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      c.checked ? "border-[#1f6b43] bg-[#f0faf4]" : "border-[#e2e8e5]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={c.checked}
                      onChange={() =>
                        setShortlist(prev =>
                          prev.map(x => x.id === c.id ? { ...x, checked: !x.checked } : x)
                        )
                      }
                      className="w-4 h-4 accent-[#1f6b43] cursor-pointer"
                    />
                    <div className="w-8 h-8 rounded-full bg-[#e8f5ee] flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-[#1f6b43]">
                        {c.name.split(" ").map(n => n[0]).join("")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827]">{c.name}</p>
                      <p className="text-[11px] text-[#6b7280]">{c.school} · {c.role}</p>
                    </div>
                    <span
                      className="text-[12px] font-bold px-2 py-0.5 rounded-lg"
                      style={{
                        background: c.score >= 85 ? "linear-gradient(180deg, #2e8b57 0%, #1f6b43 100%)" : "#f7f7f7",
                        color: c.score >= 85 ? "#fff" : "#0e3d27",
                      }}
                    >
                      {c.score}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* OFFER: compensation editor */}
            {approval.category === "OFFER" && (
              <div className="flex flex-col gap-4">
                <p className="text-[13px] text-[#6b7280]">
                  Review and adjust the offer terms before approving.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#4b5563] mb-1.5">
                      Base Salary (USD)
                    </label>
                    <div className="flex items-center border border-[#e2e8e5] rounded-xl overflow-hidden focus-within:border-[#1f6b43] transition-colors">
                      <span className="px-3 text-[13px] text-[#9ca3af] border-r border-[#e2e8e5] py-2.5">$</span>
                      <input
                        type="text"
                        value={salary}
                        onChange={e => setSalary(e.target.value)}
                        className="flex-1 px-3 py-2.5 text-[13px] text-[#111827] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#4b5563] mb-1.5">
                      Equity (%)
                    </label>
                    <div className="flex items-center border border-[#e2e8e5] rounded-xl overflow-hidden focus-within:border-[#1f6b43] transition-colors">
                      <input
                        type="text"
                        value={equity}
                        onChange={e => setEquity(e.target.value)}
                        className="flex-1 px-3 py-2.5 text-[13px] text-[#111827] focus:outline-none"
                      />
                      <span className="px-3 text-[13px] text-[#9ca3af] border-l border-[#e2e8e5] py-2.5">%</span>
                    </div>
                  </div>
                </div>
                <div className="bg-[#f7f7f7] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-[#4b5563] mb-1">Compensation band</p>
                  <p className="text-[11px] text-[#6b7280]">
                    Senior Software Engineer: $145K – $175K base · 0.1% – 0.2% equity
                  </p>
                  <p className="text-[11px] text-[#1f6b43] mt-1 font-medium">
                    ✓ Current offer is within band
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#4b5563] mb-1.5">
                    Additional Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes for the offer letter…"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#e2e8e5] text-[13px] text-[#111827] focus:outline-none focus:border-[#1f6b43] transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {/* REJECTIONS: candidate list with ability to exclude */}
            {(approval.category === "REJECTIONS" || approval.category === "SCHEDULING") && (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-[#6b7280]">
                  {approval.category === "REJECTIONS"
                    ? "Review auto-rejected candidates. Uncheck any you want to hold back from rejection."
                    : "Confirm the scheduled slots below. Uncheck any conflicts."}
                </p>
                {rejectList.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#e2e8e5]">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 accent-[#1f6b43] cursor-pointer"
                    />
                    <div className="w-7 h-7 rounded-full bg-[#f7f7f7] flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-[#6b7280]">
                        {c.name.split(" ").map((n: string) => n[0]).join("")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827]">{c.name}</p>
                      <p className="text-[11px] text-[#6b7280]">{c.reason}</p>
                    </div>
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg bg-[#f7f7f7] text-[#6b7280]">
                      {c.score}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f0f0] shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#e2e8e5] text-[13px] font-medium text-[#4b5563] hover:bg-[#f7f7f7] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors"
              style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}
            >
              Confirm & Approve
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

/* ─── Agent Log Modal ────────────────────────────────────── */

function AgentLogModal({ onClose }: { onClose: () => void }) {
  const LOG_ICONS: Record<string, string> = {
    import: "📥", flag: "🚩", score: "⚡", draft: "✉️",
    sync: "🔗", calendar: "📅", approved: "✅", offer: "📄",
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <motion.div
          className="bg-white rounded-2xl w-full max-w-lg flex flex-col"
          style={{ maxHeight: "80vh" }}
          initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0] shrink-0">
            <div>
              <h2 className="text-[18px] font-bold text-[#111827]">Agent Activity Log</h2>
              <p className="text-[12px] text-[#6b7280]">All automated actions from today</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-[#e2e8e5] flex items-center justify-center text-[#4b5563] hover:bg-[#f7f7f7] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
            {MOCK_LOG_ITEMS.map((item, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-[#f7f7f7] last:border-0">
                <div className="w-8 h-8 rounded-[10px] bg-[#e8f5ee] flex items-center justify-center shrink-0 text-sm">
                  {LOG_ICONS[item.type] ?? "⚙️"}
                </div>
                <div>
                  <p className="text-[13px] text-[#111827] font-medium">{item.label}</p>
                  <p className="text-[11px] text-[#9ca3af] mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  subtitle,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  subtitle: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex flex-col justify-between flex-1 h-[111px] rounded-[14px] pt-4 pb-3 px-3 transition-all duration-150 ${onClick ? "cursor-pointer active:scale-[0.97] hover:brightness-[1.03]" : ""}`}
      style={
        accent
          ? { background: "linear-gradient(-6.89deg, #1f6b43 9.75%, #0e3d27 73.23%)" }
          : { background: "#ffffff" }
      }
      onClick={onClick}
    >
      <div className="flex items-center justify-between w-full">
        <span
          className={`text-[13px] font-semibold leading-[19.5px] tracking-[-0.076px] whitespace-nowrap ${accent ? "text-white" : "text-[#111827]"}`}
        >
          {label}
        </span>
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center ${accent ? "bg-white" : "bg-white border border-[#0e3d27]"}`}
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-[#0e3d27]" />
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

/* ─── Approval Card ──────────────────────────────────────── */

function ApprovalCard({
  id,
  priority,
  category,
  title,
  description,
  metaIcon,
  meta1,
  meta2,
  editLabel,
  highlighted,
  isApproved = false,
  onApprove,
  onDismiss,
  onEdit,
}: Approval & {
  isApproved?: boolean;
  onApprove?: () => void;
  onDismiss?: () => void;
  onEdit?: () => void;
}) {
  const isHigh = priority === "HIGH PRIORITY";
  const MetaIcon = metaIcon === "file" ? FileText : Users;

  if (isApproved) {
    return (
      <div className="rounded-[14px] p-4 bg-[#e8f5ee] border border-[#1f6b43] flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-[#1f6b43] shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-[#1f6b43]">Approved</p>
          <p className="text-[12px] text-[#4b5563] truncate">{title}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[14px] p-4 space-y-2 w-full ${
        highlighted
          ? "bg-white border-2 border-[#1f6b43]"
          : "bg-white border border-[#e2e8e5]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2.5 py-[3px] rounded-[6px] leading-[15px] tracking-[0.117px] whitespace-nowrap border ${
                isHigh
                  ? "bg-[#1f6b43] text-white border-white"
                  : priority === "MEDIUM PRIORITY"
                  ? "bg-[#fef3c7] text-[#92400e] border-transparent"
                  : "bg-[#f7f7f7] text-[#6b7280] border-transparent"
              }`}
            >
              {priority}
            </span>
            <span className="text-[10px] font-medium bg-[#f7f7f7] text-[#4b5563] px-2 py-[2px] rounded-[6px] leading-[15px] tracking-[0.117px]">
              {category}
            </span>
          </div>
          <p className="text-[15px] font-semibold text-[#111827] leading-[22.5px] tracking-[-0.234px]">
            {title}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onApprove}
            className="h-[33px] px-[9px] rounded-[10px] border border-[#0e3d27] flex items-center gap-1 text-[12px] font-normal text-[#0e3d27] leading-[19.5px] tracking-[-0.076px] whitespace-nowrap hover:bg-[#e8f5ee] transition-all duration-150 active:scale-[0.93]"
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={onEdit}
            className="h-[33px] px-2 rounded-[10px] border border-[#6b7280] flex items-center gap-2 text-[12px] font-medium text-[#6b7280] leading-[18px] whitespace-nowrap hover:bg-gray-50 transition-all duration-150 active:scale-[0.93]"
          >
            <Pencil className="w-4 h-4" />
            {editLabel}
          </button>
          <button
            onClick={onDismiss}
            className="h-9 w-[42px] rounded-[10px] border border-[#6b7280] flex items-center justify-center text-[#6b7280] hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-[13px] font-normal text-[#4b5563] leading-[19.5px] tracking-[-0.076px]">
        {description}
      </p>
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

/* ─── Approval Breakdown Donut ───────────────────────────── */

const DONUT_DATA = [
  { name: "Interviews", pct: "40%", value: 40, color: "#6fbf9a" },
  { name: "Rejections", pct: "30%", value: 30, color: "#2e8b57" },
  { name: "Scheduling", pct: "20%", value: 20, color: "#1f6b43" },
  { name: "Offers", pct: "10%", value: 10, color: "#e2e8e5", striped: true },
];

function ApprovalBreakdown({ total }: { total: number }) {
  return (
    <div className="bg-white rounded-[14px] p-4 flex flex-col gap-6 items-center">
      <h3 className="text-[14px] font-semibold text-[#111827] leading-[21px] w-full">
        Approval Breakdown
      </h3>
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
        <div className="flex flex-col items-center text-center" style={{ marginTop: -28 }}>
          <span className="font-bold text-[#111827]" style={{ fontSize: 30, lineHeight: "36px", letterSpacing: "0.1px" }}>
            {total}
          </span>
          <span className="font-normal text-[#1f6b43]" style={{ fontSize: 14, lineHeight: "20px", letterSpacing: "0.09px" }}>
            Total
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3 w-full">
        {DONUT_DATA.map((d) => (
          <div key={d.name} className="flex items-center justify-between h-[19.5px]">
            <div className="flex items-center gap-2">
              {d.striped ? (
                <div
                  className="w-3 h-3 rounded-full shrink-0 overflow-hidden"
                  style={{
                    background: "#e2e8e5",
                    backgroundImage: "repeating-linear-gradient(-45deg, #4b5563 0px, #4b5563 2px, transparent 2px, transparent 4px)",
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

/* ─── Agent Activity ─────────────────────────────────────── */

function AgentActivity({
  items,
  onViewLog,
}: {
  items: { label: string; time: string }[];
  onViewLog: () => void;
}) {
  return (
    <div className="bg-white rounded-[14px] p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between pr-[37.82px]">
        <div className="flex flex-col gap-1">
          <h3 className="font-bold text-[#111827] whitespace-nowrap" style={{ fontSize: 18, lineHeight: "27px", letterSpacing: "-0.4395px" }}>
            Agent Activity
          </h3>
          <p className="font-normal text-[#4b5563] whitespace-nowrap" style={{ fontSize: 12, lineHeight: "18px" }}>
            Actions executed automatically by the system.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 overflow-hidden">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-[#f7f7f7] pb-px" style={{ height: 58.5 }}>
            <div className="w-8 h-8 rounded-[10px] bg-[#e8f5ee] flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-[#0e3d27]" />
            </div>
            <div className="relative flex-1 min-w-0" style={{ height: 45.5 }}>
              <p className="absolute top-px left-0 font-normal text-[#111827] whitespace-nowrap" style={{ fontSize: 13, lineHeight: "19.5px", letterSpacing: "-0.0762px" }}>
                {item.label}
              </p>
              <p className="absolute left-0 font-normal text-[#4b5563] whitespace-nowrap" style={{ top: 26, fontSize: 11, lineHeight: "16.5px", letterSpacing: "0.0645px" }}>
                {item.time}
              </p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onViewLog}
        className="relative h-9 w-full rounded-[14px] border border-[#e2e8e5] bg-white hover:bg-[#f7f7f7] transition-colors cursor-pointer"
      >
        <ChevronRight className="absolute top-[9px] text-[#4b5563]" style={{ left: 70.98, width: 16, height: 16 }} />
        <p className="absolute font-medium text-[#4b5563] text-center whitespace-nowrap" style={{ fontSize: 13, lineHeight: "19.5px", letterSpacing: "-0.0762px", top: 8.25, left: "50%", transform: "translateX(-50%)" }}>
          View Full Log
        </p>
      </button>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function HiringCenterPage() {
  const trpc = useTRPC();
  const { user } = useUser();
  const router = useRouter();

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery(
    trpc.recruiter.getDashboardStats.queryOptions()
  );
  const { data: actions } = useQuery(trpc.recruiter.getActions.queryOptions());
  const { data: candidates } = useQuery(trpc.recruiter.getCandidates.queryOptions());

  // ── Modal state ─────────────────────────────────────────
  const [showReviewAll, setShowReviewAll] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [editingApproval, setEditingApproval] = useState<Approval | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const calendarRef = useRef<HTMLDivElement>(null);

  // ── Data ────────────────────────────────────────────────
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
            a.actionType === "sync_to_ats" ? "Synced to ATS" :
            a.actionType === "follow_up_email" ? "Sent follow-up email" :
            a.actionType === "schedule_interview" ? "Scheduled interview" :
            "Moved stage",
          time: new Date(a.createdAt ?? Date.now()).toLocaleString(undefined, {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          }),
        }))
      : MOCK_ACTIVITY;

  const visibleApprovals = MOCK_APPROVALS_ALL.filter(a => !dismissedIds.has(a.id)).slice(0, 3);

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

      {/* ══ Top Card ══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="bg-[#f7f7f7] rounded-2xl px-4 py-5 flex flex-col gap-6 shrink-0">

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
          <motion.button
            onClick={() => router.push("/recruiter/roles/new/alignment")}
            whileHover={{ scale: 1.03, opacity: 0.93 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.15px] whitespace-nowrap"
            style={{ background: "linear-gradient(171.3deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}
          >
            <span className="text-[22px] font-light leading-5 w-[15px]">+</span>
            Add New Position
          </motion.button>
          <motion.button
            onClick={() => setShowImport(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="flex items-center justify-center h-10 px-[17px] py-[13px] rounded-[14px] border border-[#0e3d27] text-[14px] font-medium text-[#4b5563] leading-5 whitespace-nowrap hover:bg-[#f0faf4] transition-colors"
          >
            Import data
          </motion.button>
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
              <motion.button
                onClick={() => setShowTasks(true)}
                whileHover={{ scale: 1.03, opacity: 0.93 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="flex items-center gap-2 px-4 py-3 rounded-[14px] text-white text-[14px] font-normal leading-5 tracking-[-0.15px] whitespace-nowrap"
                style={{ background: "linear-gradient(171.26deg, #0e3d27 16.33%, #1f6b43 71.81%)" }}
              >
                Show my Tasks
                <ArrowUpRight className="w-[18px] h-[14px]" />
              </motion.button>
              {/* Calendar button — relative for popover positioning */}
              <div className="relative" ref={calendarRef}>
                <motion.button
                  onClick={() => setShowCalendar(v => !v)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className={`w-10 h-10 rounded-[10px] border flex items-center justify-center transition-colors ${
                    showCalendar
                      ? "border-[#1f6b43] bg-[#e8f5ee] text-[#1f6b43]"
                      : "border-[#e2e8e5] text-[#4b5563] hover:bg-[#e2e8e5]"
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                </motion.button>
                {showCalendar && (
                  <CalendarPopover onClose={() => setShowCalendar(false)} />
                )}
              </div>
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
            <motion.button
              onClick={() => setShowInsights(true)}
              whileHover={{ scale: 1.08, backgroundColor: "#e8f5ee" }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-[60px] h-[60px] rounded-full border border-[#0e3d27] bg-[#f7f7f7] flex items-center justify-center"
            >
              <Send className="w-5 h-5 text-[#0e3d27]" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ══ Bottom Card ══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="bg-[#f7f7f7] rounded-2xl px-4 py-5 flex flex-col gap-12 flex-1 overflow-y-auto">

        {/* Stat Cards Row */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} className="flex flex-wrap gap-4 w-full">
          <StatCard
            label="New applicants"
            value={totalCandidates}
            subtitle="Processed & screened"
            accent
            onClick={() => router.push("/recruiter/candidates")}
          />
          <StatCard
            label="Moved to Interview"
            value={inInterview}
            subtitle="Auto-advanced"
            onClick={() => router.push("/recruiter/pipeline")}
          />
          <StatCard
            label="Auto-screened out"
            value={autoScreened}
            subtitle="Below threshold"
            onClick={() => router.push("/recruiter/candidates")}
          />
          <StatCard
            label="Flagged issues"
            value={flagged}
            subtitle="Need attention"
            onClick={() => router.push("/recruiter/candidates?risk=high")}
          />
          <StatCard
            label="Offer drafted"
            value={offers}
            subtitle="Ready to send"
            onClick={() => router.push("/recruiter/pipeline")}
          />
        </motion.div>

        {/* Approvals + Sidebar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.22, ease: [0.22, 1, 0.36, 1] }} className="flex gap-6 items-start">

          {/* Left: Pending Approvals */}
          <div className="bg-white rounded-[14px] p-4 flex flex-col gap-4 flex-1 min-w-0">
            <div className="flex items-center justify-between h-[53.5px]">
              <div className="flex flex-col gap-1">
                <h2 className="text-[20px] font-bold text-[#111827] leading-[30px] tracking-[-0.449px] whitespace-nowrap">
                  Pending Approvals
                </h2>
                <p className="text-[13px] font-normal text-[#4b5563] leading-[19.5px] tracking-[-0.076px] whitespace-nowrap">
                  Decisions awaiting your confirmation.
                </p>
              </div>
              <motion.button
                onClick={() => setShowReviewAll(true)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="bg-[#1f6b43] text-white text-[12px] font-normal leading-[19.5px] tracking-[-0.076px] px-4 py-3 rounded-[10px] whitespace-nowrap hover:bg-[#0e3d27] transition-colors"
              >
                Review All ({approvalActions.length || MOCK_APPROVALS_ALL.filter(a => !dismissedIds.has(a.id)).length})
              </motion.button>
            </div>

            <div className="flex flex-col gap-3">
              {visibleApprovals.map((a) => (
                <ApprovalCard
                  key={a.id}
                  {...a}
                  isApproved={approvedIds.has(a.id)}
                  onApprove={() => setApprovedIds(prev => new Set([...prev, a.id]))}
                  onDismiss={() => setDismissedIds(prev => new Set([...prev, a.id]))}
                  onEdit={() => setEditingApproval(a)}
                />
              ))}
            </div>
          </div>

          {/* Right: Breakdown + Activity */}
          <div className="flex flex-col gap-6 w-[338px] shrink-0">
            <ApprovalBreakdown total={approvalActions.length || MOCK_APPROVALS_ALL.filter(a => !dismissedIds.has(a.id)).length} />
            <AgentActivity items={activityItems} onViewLog={() => setShowLog(true)} />
          </div>
        </motion.div>
      </motion.div>

      {/* ══ Modals & Panels ══ */}
      <AnimatePresence>
        {showReviewAll && (
          <ReviewAllModal
            key="review-all"
            approvedIds={approvedIds}
            dismissedIds={dismissedIds}
            onApprove={id => setApprovedIds(prev => new Set([...prev, id]))}
            onDismiss={id => setDismissedIds(prev => new Set([...prev, id]))}
            onEdit={approval => { setEditingApproval(approval); }}
            onClose={() => setShowReviewAll(false)}
          />
        )}
        {showTasks && <TasksPanel key="tasks" onClose={() => setShowTasks(false)} />}
        {showImport && <ImportModal key="import" onClose={() => setShowImport(false)} />}
        {showInsights && <InsightsChatPanel key="insights" onClose={() => setShowInsights(false)} />}
        {showLog && <AgentLogModal key="log" onClose={() => setShowLog(false)} />}
        {editingApproval && (
          <ApprovalEditModal
            key="edit-approval"
            approval={editingApproval}
            onClose={() => setEditingApproval(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
